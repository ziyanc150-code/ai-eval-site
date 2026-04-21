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

/**
 * 把 item 中的媒体字段剥离出来，返回“只含文字字段”的 item 与媒体资源数组，
 * 避免把超长的 Base64 Data URL 塞进 prompt 文本。
 */
function splitItemMedia(item) {
  if (!item || typeof item !== "object") {
    return { textItem: item, media: [] };
  }
  const media = [];
  const textItem = {};
  for (const [k, v] of Object.entries(item)) {
    if (k === "image_url" && typeof v === "string" && v) {
      media.push({ type: "image_url", url: v });
    } else if (k === "video_url" && typeof v === "string" && v) {
      media.push({ type: "video_url", url: v });
    } else if (k === "frame_urls" && Array.isArray(v)) {
      v.forEach((u) => u && media.push({ type: "image_url", url: u }));
    } else if (k === "audio_url" && typeof v === "string" && v) {
      media.push({ type: "audio_url", url: v });
    } else {
      textItem[k] = v;
    }
  }
  return { textItem, media };
}

/** 从模型回传的字符串里尽量提取 JSON（容忍 ```json 围栏 / 前后多余文本） */
function extractJsonFromText(text) {
  if (typeof text !== "string") return null;
  const stripped = text
    .trim()
    .replace(/^```(?:json|JSON)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const direct = safeJsonParse(stripped);
  if (direct) return direct;
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    const parsed = safeJsonParse(match[0]);
    if (parsed) return parsed;
  }
  return null;
}

/** 构造 OpenAI 兼容的 messages，多模态 content 数组 */
function buildMessages(promptText, media) {
  if (!media.length) {
    return [{ role: "user", content: promptText }];
  }
  const parts = [{ type: "text", text: promptText }];
  for (const m of media) {
    if (m.type === "image_url") {
      parts.push({ type: "image_url", image_url: { url: m.url } });
    } else if (m.type === "video_url") {
      parts.push({ type: "video_url", video_url: { url: m.url } });
    } else if (m.type === "audio_url") {
      parts.push({ type: "input_audio", input_audio: { data: m.url, format: "mp3" } });
    }
  }
  return [{ role: "user", content: parts }];
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

  const { textItem, media } = splitItemMedia(item);
  const dimsText = buildDimensionsText(dimensions);
  const primary = dimensions[0] || {};
  const rawTemplate = String(promptTemplate || "");
  const hasItemPlaceholder = /{{\s*(item|prompt|input|sample|input_text)\s*}}/i.test(rawTemplate);

  let prompt = rawTemplate
    .replaceAll("{{task_type}}", taskType || "")
    .replaceAll("{{dimensions}}", dimsText)
    .replaceAll("{{dimension_name}}", primary.name || "")
    .replaceAll("{{criteria}}", primary.criteria || "")
    .replaceAll("{{item}}", JSON.stringify(textItem, null, 2));

  if (!hasItemPlaceholder) {
    const textFields = Object.entries(textItem || {}).filter(([, v]) => v != null && String(v).trim() !== "");
    const sampleBlock = textFields.length
      ? textFields.map(([k, v]) => `【${k}】\n${typeof v === "string" ? v : JSON.stringify(v)}`).join("\n\n")
      : "（本样本无文字字段）";
    const imgs = media.filter((m) => m.type === "image_url").length;
    const vids = media.filter((m) => m.type === "video_url").length;
    const auds = media.filter((m) => m.type === "audio_url").length;
    const parts = [];
    if (imgs) parts.push(`${imgs} 张图片 / 关键帧`);
    if (vids) parts.push(`${vids} 段视频`);
    if (auds) parts.push(`${auds} 段音频`);
    const mediaHint = parts.length
      ? `本样本同时附带：${parts.join("、")}（已随本次请求以多模态形式直接发送，请基于它们评估，不要反问、不要要求"请提供"）。`
      : "本样本仅含文字字段，不含额外媒体。";
    prompt = `${prompt}\n\n----\n【待评测样本】\n${sampleBlock}\n\n${mediaHint}\n\n【输出要求】必须仅返回如下 JSON（不要任何多余文字、不要 markdown 围栏、不要反问）：\n{\n  "scores": { "${primary.name || "维度名"}": 0 },\n  "comment": "一句话总体评价",\n  "problems": "针对该维度的具体问题点"\n}`;
  }

  const payload = {
    model: String(modelName).trim(),
    messages: buildMessages(prompt, media),
    temperature: 0.2,
    response_format: { type: "json_object" }
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr) {
    throw new Error(`请求未送达（可能是 CORS 或网络错误）：${netErr.message}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 400 && /response_format/i.test(text)) {
      delete payload.response_format;
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const t2 = await res.text().catch(() => "");
        throw new Error(`API 错误 ${res.status}: ${t2}`);
      }
    } else {
      throw new Error(`API 错误 ${res.status}: ${text}`);
    }
  }

  const data = await res.json();
  let content;
  if (data && data.choices && data.choices[0]) {
    const msg = data.choices[0].message || data.choices[0];
    if (typeof msg?.content === "string") content = msg.content;
    else if (Array.isArray(msg?.content)) {
      content = msg.content.map((p) => p?.text || "").join("");
    }
  } else if (typeof data === "string") {
    content = data;
  } else if (data && (data.scores || data.comment)) {
    return data;
  }

  if (!content) {
    throw new Error(`模型返回格式无法解析：${JSON.stringify(data).slice(0, 300)}`);
  }

  const normalized = extractJsonFromText(content);
  if (!normalized) {
    throw new Error(`模型返回不是 JSON：${content.slice(0, 300)}`);
  }

  return normalized;
}

function aggregateReport(results, dimensions) {
  const scoreSums = Object.fromEntries(dimensions.map((d) => [d.name, 0]));
  const scoreCounts = Object.fromEntries(dimensions.map((d) => [d.name, 0]));
  let total = 0;
  let count = 0;

  for (const x of results) {
    const scores = x?.scores || {};
    for (const d of dimensions) {
      const raw = scores[d.name];
      if (raw === null || raw === undefined || raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      scoreSums[d.name] += v;
      scoreCounts[d.name] += 1;
      total += v;
      count += 1;
    }
  }

  const avgByDimension = {};
  dimensions.forEach((d) => {
    const n = scoreCounts[d.name];
    avgByDimension[d.name] = n ? Number((scoreSums[d.name] / n).toFixed(2)) : null;
  });

  const avgScore = count ? Number((total / count).toFixed(2)) : null;
  return {
    total_items: results.length,
    avg_score: avgScore,
    avg_by_dimension: avgByDimension,
    dimensions: dimensions.map((d) => ({ name: d.name, criteria: d.criteria })),
    items: results
  };
}

window.EvalUtils = {
  getDefaultDimensions,
  evaluateOne,
  aggregateReport
};
