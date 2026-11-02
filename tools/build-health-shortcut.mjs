// 生成「导出健康样本」快捷指令的未签名源文件。
// 用法：node tools/build-health-shortcut.mjs
// 输出：shortcuts/health-samples.shortcut（XML plist）
// 说明：iOS 15 起 .shortcut 必须由 macOS 的 `shortcuts sign` 签名后才能导入，
//       签名步骤在 .github/workflows/sign-health-shortcut.yml 中完成。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_FILE = resolve(dirname(fileURLToPath(import.meta.url)), '../shortcuts/health-samples.shortcut');

/** 固定 UUID 序列：同一份脚本每次生成的文件完全一致，便于审阅 diff */
let uuidCounter = 0;
function nextUuid() {
  uuidCounter += 1;
  return `A0000000-0000-4000-8000-${uuidCounter.toString(16).padStart(12, '0').toUpperCase()}`;
}

/** 引用某个动作的输出（Type=ActionOutput） */
function actionOutput(uuid, name) {
  return {
    Value: { OutputUUID: uuid, OutputName: name, Type: 'ActionOutput' },
    WFSerializationType: 'WFTextTokenAttachment',
  };
}

/** 引用快捷指令内置变量，例如 Repeat Item */
function namedVariable(name) {
  return {
    Value: { Type: 'Variable', VariableName: name },
    WFSerializationType: 'WFTextTokenAttachment',
  };
}

/** 由若干文本片段和变量拼出 WFTextTokenString，并计算 U+FFFC 占位符的位置 */
function textToken(parts) {
  let string = '';
  const attachmentsByRange = {};
  for (const part of parts) {
    if (typeof part === 'string') {
      string += part;
      continue;
    }
    attachmentsByRange[`{${string.length}, 1}`] = {
      OutputUUID: part.uuid,
      OutputName: part.name,
      Type: 'ActionOutput',
    };
    string += '￼';
  }
  return { Value: { string, attachmentsByRange }, WFSerializationType: 'WFTextTokenString' };
}

function action(identifier, parameters) {
  return { WFWorkflowActionIdentifier: identifier, WFWorkflowActionParameters: parameters };
}

/** 查找健康样本：类型 + 开始日期在最近 2 天内（Operator 1001 = is in the last，Unit 16384 = days） */
function findHealthSamples(uuid, typeLabel) {
  return action('is.workflow.actions.filter.health.quantity', {
    UUID: uuid,
    WFContentItemFilter: {
      Value: {
        WFActionParameterFilterPrefix: 1,
        WFContentPredicateBoundedDate: false,
        WFActionParameterFilterTemplates: [
          {
            Bounded: true,
            Operator: 4,
            Property: 'Type',
            Removable: false,
            Values: {
              Enumeration: {
                Value: typeLabel,
                WFSerializationType: 'WFStringSubstitutableState',
              },
            },
          },
          {
            Bounded: true,
            Operator: 1001,
            Property: 'Start Date',
            Removable: false,
            Values: { Number: '2', Unit: 16384 },
          },
        ],
      },
      WFSerializationType: 'WFContentPredicateTableTemplate',
    },
  });
}

function getHealthDetail(uuid, propertyName) {
  return action('is.workflow.actions.properties.health.quantity', {
    UUID: uuid,
    WFContentItemPropertyName: propertyName,
    WFInput: namedVariable('Repeat Item'),
  });
}

function formatDate(uuid, sourceUuid, sourceName, pattern) {
  return action('is.workflow.actions.format.date', {
    UUID: uuid,
    WFDate: textToken([{ uuid: sourceUuid, name: sourceName }]),
    WFDateFormatStyle: 'Custom',
    WFDateFormat: pattern,
  });
}

/**
 * 生成一组「查找样本 → 循环拼行 → 合并文本」的动作。
 * includeEndDate 为 true 时输出 start|end|value（睡眠阶段样本需要结束时间）。
 */
function buildSampleLoop(typeLabel, includeEndDate, commentText) {
  const actions = [];
  const findUuid = nextUuid();
  const group = nextUuid();
  const startDetailUuid = nextUuid();
  const startFormatUuid = nextUuid();
  const endDetailUuid = includeEndDate ? nextUuid() : null;
  const endFormatUuid = includeEndDate ? nextUuid() : null;
  const valueUuid = nextUuid();
  const rowTextUuid = nextUuid();
  const endRepeatUuid = nextUuid();
  const combineUuid = nextUuid();
  const isoPattern = "yyyy-MM-dd'T'HH:mm:ssXXXXX";

  actions.push(findHealthSamples(findUuid, typeLabel));
  actions.push(
    action('is.workflow.actions.comment', {
      WFCommentActionText: commentText,
    }),
  );
  actions.push(
    action('is.workflow.actions.repeat.each', {
      GroupingIdentifier: group,
      WFControlFlowMode: 0,
      WFInput: actionOutput(findUuid, 'Health Samples'),
    }),
  );
  actions.push(getHealthDetail(startDetailUuid, 'Start Date'));
  actions.push(formatDate(startFormatUuid, startDetailUuid, 'Start Date', isoPattern));

  if (includeEndDate) {
    actions.push(getHealthDetail(endDetailUuid, 'End Date'));
    actions.push(formatDate(endFormatUuid, endDetailUuid, 'End Date', isoPattern));
  }

  actions.push(getHealthDetail(valueUuid, 'Value'));

  const rowParts = [{ uuid: startFormatUuid, name: 'Formatted Date' }];
  if (includeEndDate) {
    rowParts.push('|', { uuid: endFormatUuid, name: 'Formatted Date' });
  }
  rowParts.push('|', { uuid: valueUuid, name: 'Value' });

  actions.push(
    action('is.workflow.actions.gettext', {
      UUID: rowTextUuid,
      WFTextActionText: textToken(rowParts),
    }),
  );
  actions.push(
    action('is.workflow.actions.repeat.each', {
      UUID: endRepeatUuid,
      GroupingIdentifier: group,
      WFControlFlowMode: 2,
    }),
  );
  actions.push(
    action('is.workflow.actions.text.combine', {
      UUID: combineUuid,
      WFInput: actionOutput(endRepeatUuid, 'Repeat Results'),
      WFTextSeparator: 'Custom',
      WFTextCustomSeparator: ';',
    }),
  );

  return { actions, combineUuid };
}

const steps = buildSampleLoop('Steps', false, '读取最近 2 天的步数样本，逐条拼成「开始时间|数值」');
const restingHeartRate = buildSampleLoop(
  'Resting Heart Rate',
  false,
  '读取最近 2 天的静息心率样本，逐条拼成「开始时间|数值」',
);
const sleep = buildSampleLoop('Sleep', true, '读取最近 2 天的睡眠样本，逐条拼成「开始时间|结束时间|阶段」');

const nowUuid = nextUuid();
const nowFormatUuid = nextUuid();
const finalTextUuid = nextUuid();
const setNameUuid = nextUuid();
const saveUuid = nextUuid();

const actions = [
  ...steps.actions,
  ...restingHeartRate.actions,
  ...sleep.actions,
  action('is.workflow.actions.date', {
    UUID: nowUuid,
    WFDateActionMode: 'Current Date',
  }),
  formatDate(nowFormatUuid, nowUuid, 'Date', "yyyy-MM-dd'T'HH:mm:ssXXXXX"),
  action('is.workflow.actions.gettext', {
    UUID: finalTextUuid,
    WFTextActionText: textToken([
      '{"schema":"healthsleep.samples.v1","generatedAt":"',
      { uuid: nowFormatUuid, name: 'Formatted Date' },
      '","steps":"',
      { uuid: steps.combineUuid, name: 'Combined Text' },
      '","restingHeartRate":"',
      { uuid: restingHeartRate.combineUuid, name: 'Combined Text' },
      '","sleep":"',
      { uuid: sleep.combineUuid, name: 'Combined Text' },
      '"}',
    ]),
  }),
  action('is.workflow.actions.setitemname', {
    UUID: setNameUuid,
    WFInput: actionOutput(finalTextUuid, 'Text'),
    WFName: 'health-samples.json',
  }),
  action('is.workflow.actions.documentpicker.save', {
    WFInput: actionOutput(setNameUuid, 'Renamed Item'),
    WFAskWhereToSave: false,
    WFSaveFileOverwrite: true,
  }),
];

const workflow = {
  WFWorkflowActions: actions,
  WFWorkflowClientVersion: '2700.0.4',
  WFWorkflowClientRelease: '26A0000a',
  WFWorkflowMinimumClientVersion: 900,
  WFWorkflowMinimumClientVersionString: '900',
  WFWorkflowIcon: {
    WFWorkflowIconGlyphNumber: 61440,
    WFWorkflowIconStartColor: 431817727,
  },
  WFWorkflowName: '导出健康样本',
  WFWorkflowHasOutputFallback: false,
  WFWorkflowImportQuestions: [],
  WFWorkflowOutputContentItemClasses: [],
  WFWorkflowTypes: [],
  WFWorkflowInputContentItemClasses: [],
};

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toPlist(value, indent) {
  const pad = '\t'.repeat(indent);
  if (typeof value === 'string') {
    return `${pad}<string>${escapeXml(value)}</string>`;
  }
  if (typeof value === 'number') {
    return `${pad}<integer>${value}</integer>`;
  }
  if (typeof value === 'boolean') {
    return `${pad}<${value ? 'true' : 'false'}/>`;
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => toPlist(item, indent + 1)).join('\n');
    return `${pad}<array>\n${items}\n${pad}</array>`;
  }
  const entries = Object.entries(value)
    .map(([key, item]) => `${pad}\t<key>${escapeXml(key)}</key>\n${toPlist(item, indent + 1)}`)
    .join('\n');
  return `${pad}<dict>\n${entries}\n${pad}</dict>`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${toPlist(workflow, 0)}
</plist>
`;

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, xml, 'utf8');
console.log(`已生成 ${OUT_FILE}（${actions.length} 个动作）`);
