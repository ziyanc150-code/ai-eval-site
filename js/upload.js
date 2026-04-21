const evalUtils = window.EvalUtils;
const supabaseUtils = window.SupabaseUtils;
const authUtils = window.Auth;

const dimensionsEl = document.getElementById("dimensions");
const loadTemplateBtn = document.getElementById("loadTemplateBtn");
const addDimensionBtn = document.getElementById("addDimensionBtn");
const runEvalBtn = document.getElementById("runEvalBtn");
const statusText = document.getElementById("statusText");
const dataFileEl = document.getElementById("dataFile");
const mediaFilesEl = document.getElementById("mediaFiles");
const videoFrameCountEl = document.getElementById("videoFrameCount");
const mediaPreviewEl = document.getElementById("mediaPreview");

const apiEndpointEl = document.getElementById("apiEndpoint");
const apiKeyEl = document.getElementById("apiKey");
const modelNameEl = document.getElementById("modelName");
const taskTypeEl = document.getElementById("taskType");
const logoutBtn = document.getElementById("logoutBtn");

/** 新建维度行时的默认提示词骨架（占位符由 eval.js 在请求前替换） */
function buildDefaultDimensionPrompt() {
  return `你是严格、专业的评测员。请仅针对下列一个维度打分，不要评价其他维度。

维度名称：{{dimension_name}}
评分标准：{{criteria}}

输入样本（文字字段）：
{{item}}

上述样本可能同时附带图片 / 视频 / 关键帧，已随本次请求以多模态形式传给你。
请基于这些多模态内容进行评估。如果你看不到媒体，请在 comment 里明确写「未收到媒体」并将 score 设为 null。

打分要求：
- score 必须是 0 到 10 之间的「整数」；0 代表严重不合格，10 代表完美符合；不要返回区间字符串。
- problems 必须具体说明：发现的问题、缺陷点、与评分标准的差距；若几乎没问题也要写「无明显问题，细节：...」。
- 不要空字符串，不要省略字段。

严格返回以下 JSON（不要任何多余文字、不要 markdown 代码围栏）：
{
  "scores": { "{{dimension_name}}": 0 },
  "comment": "一句话总体评价",
  "problems": "针对该维度的具体问题点，条列或句子均可"
}`;
}

const TASK_PRESETS = {
  text_to_video: {
    dimensions: [
      { name: "视觉质量", criteria: "清晰度/分辨率稳定性；噪点、伪影、闪烁；色彩准确性与一致性；曝光与对比度" },
      { name: "时序一致性", criteria: "帧间连贯性；物体ID一致性；光影连续性；背景稳定性" },
      { name: "运动质量", criteria: "运动流畅度；运动合理性；运动幅度与速度自然度；相机运动稳定性" },
      { name: "主体对齐", criteria: "主体数量正确性；主体属性；主体状态（表情、姿态）" },
      { name: "动作对齐", criteria: "动作类型、主体、对象、时序是否正确" },
      { name: "场景对齐", criteria: "环境地点、时间（昼夜季节）、天气与氛围是否匹配" },
      { name: "镜头语言对齐", criteria: "景别、镜头运动（推拉摇移跟）、视角（俯仰平）是否匹配" },
      { name: "风格对齐", criteria: "艺术风格（写实/动漫/油画等）与情绪氛围一致性" },
      { name: "物理合理性", criteria: "重力惯性碰撞、流体、刚软体变形、光影物理、人体解剖学合理性" },
      { name: "安全与合规", criteria: "涉政涉黄暴力血腥、版权内容、误导性内容、未成年人相关风险" }
    ]
  },
  image_to_video: {
    dimensions: [
      { name: "首帧一致性", criteria: "首帧与输入图像像素/结构相似度（PSNR、SSIM、LPIPS）" },
      { name: "主体一致性", criteria: "主体身份、外观、细节跨帧保持（DINO/CLIP特征相似度）" },
      { name: "背景一致性", criteria: "非运动区域稳定、无漂移" },
      { name: "风格一致性", criteria: "画风、色调、光影延续输入图像" },
      { name: "视频本体质量", criteria: "时间一致性、运动合理性、运动幅度、单帧画质、分辨率与帧率稳定性" },
      { name: "指令遵循", criteria: "Prompt遵循度、镜头控制准确性、物体交互合理性、物理常识合理性" },
      { name: "安全与可用性", criteria: "NSFW/暴力血腥、名人/IP侵权、偏见与刻板印象、可用率（崩坏黑屏静止）" }
    ]
  },
  text_to_image: {
    dimensions: [
      { name: "图文一致性", criteria: "对象存在性、属性绑定、数量准确、空间关系（2D/3D）" },
      { name: "图像质量", criteria: "结构合理性、分辨率与锐度、光影一致性、纹理真实性" },
      { name: "美学", criteria: "构图、色彩、风格一致性、艺术性表达" },
      { name: "能力维度", criteria: "逻辑合理性、知识、文字渲染、复杂指令分层能力" },
      { name: "可控性", criteria: "风格控制、视角镜头控制、长Prompt细节遵循度" },
      { name: "安全与伦理", criteria: "合规性（暴力血腥性相关）、偏见、公平性" }
    ]
  },
  text: {
    dimensions: [
      { name: "任务准确性", criteria: "知识问答、阅读理解、推理、代码、摘要、翻译、信息抽取/结构化、分类情感等准确性" },
      { name: "生成质量", criteria: "流畅性、连贯性、信息量、相关性、简洁性、风格一致性" },
      { name: "指令遵循", criteria: "格式遵循、约束遵循、多步指令执行、角色扮演一致性" },
      { name: "事实性与可信性", criteria: "事实准确率/幻觉率、校准能力、引用忠实度、抗拒幻觉能力" },
      { name: "推理能力", criteria: "数学、逻辑、常识、因果、多跳、反事实推理" },
      { name: "鲁棒性", criteria: "输入扰动稳定性、对抗攻击抵抗、长上下文能力、分布外表现" },
      { name: "安全与伦理", criteria: "毒性、偏见、公平性、隐私、有害指令拒绝率、过度拒绝" },
      { name: "多语言与文化", criteria: "多语言能力、code-switching、文化适配" },
      { name: "工程与效率", criteria: "延迟、吞吐/成本、稳定性/API错误率" },
      { name: "交互能力", criteria: "多轮一致性、上下文记忆、澄清能力、拒绝得体性" }
    ]
  }
};

function getTaskPreset(taskType) {
  return TASK_PRESETS[taskType] || TASK_PRESETS.text;
}

function setStatus(msg) {
  statusText.textContent = msg;
}

function createDimensionRow(name = "", criteria = "", prompt = "") {
  const row = document.createElement("div");
  row.className = "dimension-row";

  const fields = document.createElement("div");
  fields.className = "dim-fields";

  const labName = document.createElement("label");
  labName.textContent = "维度名称";
  const inpName = document.createElement("input");
  inpName.className = "dim-name";
  inpName.type = "text";
  inpName.placeholder = "维度名称";
  inpName.value = name;
  labName.appendChild(inpName);

  const labCrit = document.createElement("label");
  labCrit.textContent = "评分标准";
  const inpCrit = document.createElement("input");
  inpCrit.className = "dim-criteria";
  inpCrit.type = "text";
  inpCrit.placeholder = "评分标准（0-10）";
  inpCrit.value = criteria;
  labCrit.appendChild(inpCrit);

  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "remove-dim";
  rm.textContent = "删除";
  rm.addEventListener("click", () => row.remove());

  fields.appendChild(labName);
  fields.appendChild(labCrit);
  fields.appendChild(rm);

  const labPrompt = document.createElement("label");
  labPrompt.className = "dim-prompt-label";
  labPrompt.appendChild(document.createTextNode("该维度的评测提示词"));
  const ta = document.createElement("textarea");
  ta.className = "dim-prompt";
  ta.rows = 4;
  ta.placeholder = "可使用 {{item}}、{{dimension_name}}、{{criteria}} 等占位符";
  ta.value = prompt && String(prompt).trim() ? prompt : buildDefaultDimensionPrompt();
  labPrompt.appendChild(ta);

  row.appendChild(fields);
  row.appendChild(labPrompt);
  dimensionsEl.appendChild(row);
}

function getDimensionsFromUI() {
  const rows = [...dimensionsEl.querySelectorAll(".dimension-row")];
  return rows
    .map((row) => {
      const name = row.querySelector(".dim-name").value.trim();
      const criteria = row.querySelector(".dim-criteria").value.trim();
      const prompt = row.querySelector(".dim-prompt").value.trim();
      return { name, criteria, prompt };
    })
    .filter((x) => x.name && x.prompt);
}

function parseJsonl(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function readXlsxFile(file) {
  if (typeof XLSX === "undefined") {
    throw new Error("未加载表格解析库，请检查网络能否访问 cdnjs 上的 xlsx，或刷新页面重试。");
  }
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return [];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return rows.map((row) => {
      const out = {};
      Object.keys(row).forEach((k) => {
        out[String(k).trim()] = row[k];
      });
      return out;
    });
  });
}

async function readDataFile(file) {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    return readXlsxFile(file);
  }
  const text = await file.text();
  if (file.name.endsWith(".jsonl")) return parseJsonl(text);
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [data];
}

function smartDecodeZipName(bytes) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (_e) {
    try { return new TextDecoder("gbk").decode(bytes); } catch (_e2) {}
    try { return new TextDecoder("gb18030").decode(bytes); } catch (_e3) {}
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function guessMimeFromName(name) {
  const l = String(name || "").toLowerCase();
  if (l.endsWith(".mp4") || l.endsWith(".m4v")) return "video/mp4";
  if (l.endsWith(".webm")) return "video/webm";
  if (l.endsWith(".mov")) return "video/quicktime";
  if (l.endsWith(".mkv")) return "video/x-matroska";
  if (l.endsWith(".avi")) return "video/x-msvideo";
  if (l.endsWith(".png")) return "image/png";
  if (/\.jpe?g$/.test(l)) return "image/jpeg";
  if (l.endsWith(".gif")) return "image/gif";
  if (l.endsWith(".webp")) return "image/webp";
  if (l.endsWith(".bmp")) return "image/bmp";
  if (l.endsWith(".avif")) return "image/avif";
  if (l.endsWith(".heic")) return "image/heic";
  if (l.endsWith(".json")) return "application/json";
  if (l.endsWith(".jsonl")) return "application/jsonl";
  if (l.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (l.endsWith(".xls")) return "application/vnd.ms-excel";
  return "";
}

async function unzipToFiles(zipFile, onProgress) {
  if (typeof JSZip === "undefined") {
    throw new Error("未加载 JSZip，请检查网络是否能访问 cdnjs，或刷新页面。");
  }
  const buf = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(buf, { decodeFileName: smartDecodeZipName });
  const entries = Object.values(zip.files).filter((e) => !e.dir);
  const out = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (onProgress) onProgress(i + 1, entries.length, entry.name);
    const blob = await entry.async("blob");
    const short = entry.name.split(/[\\/]/).pop() || entry.name;
    const mime = guessMimeFromName(short) || blob.type || "";
    out.push(new File([blob], short, { type: mime }));
  }
  return out;
}

async function expandZipFiles(files, onProgress) {
  const result = [];
  for (const f of files) {
    const name = String(f.name || "").toLowerCase();
    const isZip = name.endsWith(".zip") || (f.type || "").toLowerCase().includes("zip");
    if (isZip) {
      if (onProgress) onProgress(`正在解包 ${f.name}...`);
      const inner = await unzipToFiles(f, (idx, total, inName) => {
        if (onProgress) onProgress(`解包 ${f.name}: ${idx}/${total} (${inName})`);
      });
      result.push(...inner);
    } else {
      result.push(f);
    }
  }
  return result;
}

function classifyFiles(files) {
  const dataFiles = [];
  const mediaFiles = [];
  const others = [];
  for (const f of files) {
    const l = f.name.toLowerCase();
    if (/\.(json|jsonl|xlsx|xls)$/.test(l)) dataFiles.push(f);
    else if (detectMediaType(f)) mediaFiles.push(f);
    else others.push(f);
  }
  return { dataFiles, mediaFiles, others };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    r.readAsDataURL(file);
  });
}

function detectMediaType(file) {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("video")) return "video";
  if (t.startsWith("image")) return "image";
  const lower = file.name.toLowerCase();
  if (/\.(mp4|webm|mov|mkv|avi|m4v)$/.test(lower)) return "video";
  if (/\.(png|jpe?g|gif|webp|bmp|avif|heic)$/.test(lower)) return "image";
  return null;
}

async function extractVideoFrames(file, count) {
  const n = Math.max(0, Math.min(16, Number(count) || 0));
  if (!n) return [];
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error(`无法加载视频：${file.name}`));
    });
    const duration = Number(video.duration) || 0;
    if (!duration || !isFinite(duration)) return [];
    const maxWidth = 512;
    const vw = video.videoWidth || maxWidth;
    const vh = video.videoHeight || Math.round(maxWidth * 9 / 16);
    const scale = Math.min(1, maxWidth / vw);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(vw * scale));
    canvas.height = Math.max(1, Math.round(vh * scale));
    const ctx = canvas.getContext("2d");
    const frames = [];
    for (let i = 0; i < n; i += 1) {
      const t = Math.min(duration - 0.05, (duration * (i + 0.5)) / n);
      await new Promise((res, rej) => {
        video.onseeked = () => res();
        video.onerror = () => rej(new Error(`视频抽帧失败：${file.name}`));
        video.currentTime = Math.max(0, t);
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.8));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function processMediaFiles(files, frameCount) {
  const entries = [];
  const map = new Map();
  for (const f of files) {
    const type = detectMediaType(f);
    if (!type) continue;
    const dataUrl = await fileToDataUrl(f);
    const entry = { name: f.name, size: f.size, type, dataUrl };
    if (type === "video") {
      try {
        entry.frames = await extractVideoFrames(f, frameCount);
      } catch (err) {
        entry.frame_error = err.message;
        entry.frames = [];
      }
    }
    entries.push(entry);
    const base = f.name.replace(/\.[^.]+$/, "");
    if (!map.has(f.name)) map.set(f.name, entry);
    if (!map.has(base)) map.set(base, entry);
  }
  return { entries, map };
}

function renderMediaPreview(entries) {
  if (!mediaPreviewEl) return;
  mediaPreviewEl.innerHTML = "";
  if (!entries.length) return;
  const totalBytes = entries.reduce((s, e) => s + (e.size || 0), 0);
  const info = document.createElement("div");
  info.className = "media-preview-info";
  info.textContent = `共 ${entries.length} 个媒体文件，合计约 ${(totalBytes / 1024 / 1024).toFixed(2)} MB`;
  mediaPreviewEl.appendChild(info);

  const grid = document.createElement("div");
  grid.className = "media-preview-grid";
  entries.slice(0, 12).forEach((e) => {
    const cell = document.createElement("div");
    cell.className = "media-preview-cell";
    let thumb;
    if (e.type === "image") {
      thumb = document.createElement("img");
      thumb.src = e.dataUrl;
      thumb.alt = e.name;
    } else {
      thumb = document.createElement("video");
      thumb.src = e.dataUrl;
      thumb.muted = true;
      thumb.playsInline = true;
      thumb.controls = true;
    }
    const caption = document.createElement("div");
    caption.className = "media-preview-caption";
    const frameTip = e.type === "video" ? `（抽帧 ${e.frames ? e.frames.length : 0} 张）` : "";
    caption.textContent = `${e.name} ${frameTip}`;
    cell.appendChild(thumb);
    cell.appendChild(caption);
    grid.appendChild(cell);
  });
  mediaPreviewEl.appendChild(grid);
  if (entries.length > 12) {
    const more = document.createElement("div");
    more.className = "media-preview-info";
    more.textContent = `…另有 ${entries.length - 12} 个文件未预览。`;
    mediaPreviewEl.appendChild(more);
  }
}

function mediaEntriesToItems(entries) {
  return entries.map((e, idx) => {
    const item = { id: e.name, input_text: e.name.replace(/\.[^.]+$/, "") };
    if (e.type === "image") {
      item.image_url = e.dataUrl;
    } else {
      item.video_url = e.dataUrl;
      if (e.frames && e.frames.length) item.frame_urls = e.frames;
    }
    if (!item.id) item.id = `media_${idx + 1}`;
    return item;
  });
}

function mergeItemsWithMedia(items, mediaMap) {
  if (!mediaMap || !mediaMap.size) return items;
  return items.map((it, idx) => {
    const out = { ...it };
    const candidates = [it.file, it.media_file, it.filename, it.video_file, it.image_file, it.id]
      .filter(Boolean)
      .map((x) => String(x).trim());
    let matched = null;
    for (const key of candidates) {
      if (mediaMap.has(key)) { matched = mediaMap.get(key); break; }
      const base = key.replace(/\.[^.]+$/, "");
      if (mediaMap.has(base)) { matched = mediaMap.get(base); break; }
    }
    if (!matched) return out;
    if (matched.type === "image" && !out.image_url) out.image_url = matched.dataUrl;
    if (matched.type === "video") {
      if (!out.video_url) out.video_url = matched.dataUrl;
      if (matched.frames && matched.frames.length && !out.frame_urls) {
        out.frame_urls = matched.frames;
      }
    }
    if (!out.id) out.id = matched.name;
    return out;
  });
}

function persistHistory(entry) {
  const key = "eval_history";
  const oldData = JSON.parse(localStorage.getItem(key) || "[]");
  oldData.unshift(entry);
  localStorage.setItem(key, JSON.stringify(oldData.slice(0, 50)));
}

function genRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadTaskTemplate(taskType) {
  const preset = getTaskPreset(taskType);
  dimensionsEl.innerHTML = "";
  preset.dimensions.forEach((d) => {
    const p = d.prompt && String(d.prompt).trim() ? d.prompt : buildDefaultDimensionPrompt();
    createDimensionRow(d.name, d.criteria, p);
  });
}

function init() {
  if (!evalUtils || !supabaseUtils || !authUtils) {
    setStatus("脚本加载失败，请使用 http://127.0.0.1:5500/index.html 打开，并刷新页面。");
    return;
  }
  authUtils.requireAuth("/index.html");
  const appConfig = window.APP_CONFIG || {};
  if (appConfig.apiEndpoint) apiEndpointEl.value = appConfig.apiEndpoint;
  if (appConfig.apiKey) apiKeyEl.value = appConfig.apiKey;
  if (appConfig.modelName) modelNameEl.value = appConfig.modelName;
  loadTaskTemplate(taskTypeEl.value);
}

loadTemplateBtn.addEventListener("click", () => {
  loadTaskTemplate(taskTypeEl.value);
  setStatus("已加载当前任务类型的基础评分模板。");
});

addDimensionBtn.addEventListener("click", () => {
  createDimensionRow("", "", buildDefaultDimensionPrompt());
});

taskTypeEl.addEventListener("change", () => {
  loadTaskTemplate(taskTypeEl.value);
  setStatus("已切换任务类型模板。");
});

if (mediaFilesEl) {
  mediaFilesEl.addEventListener("change", async () => {
    try {
      const raw = [...(mediaFilesEl.files || [])];
      if (!raw.length) {
        renderMediaPreview([]);
        return;
      }
      setStatus(`读取 ${raw.length} 个文件（含 ZIP 会自动解包）...`);
      const expanded = await expandZipFiles(raw, (msg) => setStatus(msg));
      const { mediaFiles: m } = classifyFiles(expanded);
      if (!m.length) {
        renderMediaPreview([]);
        setStatus("ZIP / 选中文件里未识别到任何图片或视频。");
        return;
      }
      const frameCount = Number(videoFrameCountEl?.value || 0);
      setStatus(`读取媒体中（${m.length} 个，抽帧 ${frameCount}）...`);
      const { entries } = await processMediaFiles(m, frameCount);
      renderMediaPreview(entries);
      const big = entries.filter((e) => (e.size || 0) > 8 * 1024 * 1024);
      const totalMB = entries.reduce((s, e) => s + (e.size || 0), 0) / 1024 / 1024;
      let msg = `媒体文件已载入：${entries.length} 个，约 ${totalMB.toFixed(2)} MB。`;
      if (big.length) msg += ` ⚠ 其中 ${big.length} 个 > 8MB，Base64 后可能超出模型 API 上限，建议先压缩或删减。`;
      setStatus(msg);
    } catch (err) {
      setStatus(`读取媒体失败：${err.message}`);
    }
  });
}

logoutBtn.addEventListener("click", (e) => {
  e.preventDefault();
  authUtils.clearAccessKey();
  window.location.href = "/index.html";
});

runEvalBtn.addEventListener("click", async () => {
  try {
    const { evaluateOne, aggregateReport } = evalUtils || {};
    const { saveToSupabase } = supabaseUtils || {};
    if (!evaluateOne || !aggregateReport || !saveToSupabase) {
      setStatus("脚本尚未准备完成，请刷新页面后重试。");
      return;
    }
    const apiEndpoint = apiEndpointEl.value.trim();
    const apiKey = apiKeyEl.value.trim();
    const modelName = modelNameEl.value.trim();
    const taskType = taskTypeEl.value;
    const accessKey = authUtils.getAccessKey();
    const dimensions = getDimensionsFromUI();
    const rawDataFiles = [...(dataFileEl.files || [])];
    const rawMediaFiles = [...(mediaFilesEl?.files || [])];
    const frameCount = Number(videoFrameCountEl?.value || 0);

    let file = null;
    let mediaFiles = [];
    if (rawDataFiles.length || rawMediaFiles.length) {
      setStatus("正在检查上传文件（含 ZIP 会自动解包）...");
      const expanded = await expandZipFiles([...rawDataFiles, ...rawMediaFiles], (msg) => setStatus(msg));
      const { dataFiles, mediaFiles: m } = classifyFiles(expanded);
      file = dataFiles[0] || null;
      mediaFiles = m;
    }

    if (!accessKey) {
      setStatus("登录已失效，请重新登录。");
      window.location.href = "/index.html";
      return;
    }
    if (!apiEndpoint) {
      setStatus("请填写评测 API Endpoint（本站不代付，必须直连你的 API）。");
      return;
    }
    if (!apiKey) {
      setStatus("请填写 API Key（本站不代付，必须使用你自己的密钥）。");
      return;
    }
    if (!modelName) {
      setStatus("请填写模型名称。");
      return;
    }
    if (!file && !mediaFiles.length) {
      setStatus("请至少上传数据文件或媒体文件（可以是 ZIP 压缩包）。");
      return;
    }
    if (!dimensions.length) {
      setStatus("请至少设置一个评分维度，且每个维度需填写名称与评测提示词。");
      return;
    }

    let items = [];
    let mediaResult = { entries: [], map: new Map() };
    if (mediaFiles.length) {
      setStatus(`读取媒体文件 0/${mediaFiles.length}（抽帧：${frameCount}）...`);
      mediaResult = await processMediaFiles(mediaFiles, frameCount);
      renderMediaPreview(mediaResult.entries);
    }

    if (file) {
      setStatus("读取数据文件...");
      items = await readDataFile(file);
      if (!items.length) {
        setStatus("数据文件为空或没有有效行。");
        return;
      }
      if (mediaResult.map.size) {
        items = mergeItemsWithMedia(items, mediaResult.map);
      }
    } else {
      items = mediaEntriesToItems(mediaResult.entries);
      if (!items.length) {
        setStatus("未识别到任何可用的图片/视频文件。");
        return;
      }
    }

    const results = [];
    const totalCalls = items.length * dimensions.length;
    let doneCalls = 0;

    for (let i = 0; i < items.length; i += 1) {
      const mergedScores = {};
      const dimensionDetails = [];
      for (let j = 0; j < dimensions.length; j += 1) {
        const dim = dimensions[j];
        doneCalls += 1;
        setStatus(`评测进行中 ${doneCalls}/${totalCalls}（第 ${i + 1}/${items.length} 条 · 维度「${dim.name}」）...`);
        let scoreJson = {};
        let callError = null;
        try {
          scoreJson = await evaluateOne({
            apiEndpoint,
            apiKey,
            modelName,
            taskType,
            promptTemplate: dim.prompt,
            dimensions: [dim],
            item: items[i]
          });
        } catch (err) {
          callError = err.message;
        }
        const sc = scoreJson && scoreJson.scores && typeof scoreJson.scores === "object" ? scoreJson.scores : {};
        const dimScoreRaw = sc[dim.name];
        const dimScore = dimScoreRaw === null || dimScoreRaw === undefined || dimScoreRaw === ""
          ? null
          : Number(dimScoreRaw);
        if (dimScore !== null && !Number.isNaN(dimScore)) mergedScores[dim.name] = dimScore;
        dimensionDetails.push({
          dimension: dim.name,
          criteria: dim.criteria,
          score: Number.isFinite(dimScore) ? dimScore : null,
          comment: scoreJson?.comment || "",
          problems: scoreJson?.problems || "",
          error: callError
        });
      }
      results.push({
        input_id: items[i].id ?? `item_${i + 1}`,
        scores: mergedScores,
        dimensions: dimensionDetails
      });
    }

    const report = aggregateReport(results, dimensions);
    const runId = genRunId();
    const createdAt = new Date().toISOString();
    const fullReport = {
      ...report,
      run_id: runId,
      created_at: createdAt,
      task_type: taskType,
      model_name: modelName,
      dimensions: dimensions.map((d) => ({ name: d.name, criteria: d.criteria }))
    };
    const record = {
      task_type: taskType,
      model_name: modelName,
      prompt_mode: "per_dimension",
      dimensions,
      raw_results: results,
      avg_score: report.avg_score,
      created_at: createdAt
    };

    await saveToSupabase(record);

    localStorage.setItem("latest_eval_report", JSON.stringify(fullReport));
    persistHistory({
      id: runId,
      created_at: createdAt,
      task_type: taskType,
      model_name: modelName,
      avg_score: report.avg_score,
      avg_by_dimension: report.avg_by_dimension,
      dimensions: dimensions.map((d) => ({ name: d.name, criteria: d.criteria })),
      report: fullReport
    });

    setStatus("评测完成，正在跳转报告页...");
    window.location.href = `./report.html?id=${encodeURIComponent(runId)}`;
  } catch (err) {
    setStatus(`执行失败：${err.message}`);
  }
});

init();
