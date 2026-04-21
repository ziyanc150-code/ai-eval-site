const DEFAULT_DIMENSIONS = [
  { name: "相关性", criteria: "输出是否符合输入需求，0-10 分" },
  { name: "正确性", criteria: "内容事实或语义是否正确，0-10 分" },
  { name: "完整性", criteria: "是否有遗漏重要信息，0-10 分" },
  { name: "可读性", criteria: "表达是否清晰流畅，0-10 分" }
];

function buildDimensionsText(dimensions) {
  return dimensions
    .map((d, idx) => `${idx + 1}. ${d.name}: ${d.criteria}`)
    .join("\n");
}

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch (_err) {
    return null;
  }
}

function getDefaultDimensions() {
  return [...DEFAULT_DIMENSIONS];
}

async function evaluateOne({
  apiEndpoint,
  apiKey,
  modelName,
  taskType,
  promptTemplate,
  dimensions,
  item
}) {
  const endpoint = String(apiEndpoint || "").trim();
  const key = String(apiKey || "").trim();
  if (!endpoint || !key) {
    throw new Error("请填写「评测 API Endpoint」和「API Key」（本站不代付模型费用）。");
  }
  if (!String(modelName || "").trim()) {
    throw new Error("请填写模型名称。");
  }

  const dimsText = buildDimensionsText(dimensions);
  const prompt = promptTemplate
    .replaceAll("{{task_type}}", taskType)
    .replaceAll("{{dimensions}}", dimsText)
    .replaceAll("{{item}}", JSON.stringify(item, null, 2));

  const payload = {
    model: modelName,
    task_type: taskType,
    prompt,
    dimensions,
    input: item
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API 错误 ${res.status}: ${text}`);
  }

  const data = await res.json();
  const normalized = typeof data === "string" ? safeJsonParse(data) : data;
  if (!normalized) {
    throw new Error("模型返回非 JSON，请检查 API 转接层。");
  }

  return normalized;
}

function aggregateReport(results, dimensions) {
  const scoreSums = Object.fromEntries(dimensions.map((d) => [d.name, 0]));
  let total = 0;
  let count = 0;

  for (const x of results) {
    const scores = x?.scores || {};
    for (const d of dimensions) {
      const v = Number(scores[d.name] ?? 0);
      scoreSums[d.name] += v;
      total += v;
      count += 1;
    }
  }

  const avgByDimension = {};
  dimensions.forEach((d) => {
    avgByDimension[d.name] = results.length ? Number((scoreSums[d.name] / results.length).toFixed(2)) : 0;
  });

  const avgScore = count ? Number((total / count).toFixed(2)) : 0;
  return {
    total_items: results.length,
    avg_score: avgScore,
    avg_by_dimension: avgByDimension,
    items: results
  };
}

window.EvalUtils = {
  getDefaultDimensions,
  evaluateOne,
  aggregateReport
};
