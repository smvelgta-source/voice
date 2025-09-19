/* ---------- helpers ---------- */
export const $  = q => document.querySelector(q);
export const $$ = q => document.querySelectorAll(q);
export function status(txt, type = "info") {
  const s = $("#status");
  s.className = "status status-" + type;
  s.textContent = txt;
}

/* ---------- 1. browser WAV recorder ---------- */
export async function recordWAV() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  const chunks = [];
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.start();
  await new Promise(resolve => {
    recorder.onstop = resolve;
    setTimeout(() => recorder.stop(), 7000);        // max 7 s
  });
  stream.getTracks().forEach(t => t.stop());
  return new Blob(chunks, { type: "audio/webm" });
}

/* ---------- 2. Whisper cloud call ---------- */
const OPENAI_KEY = "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"; // <-- paste your key here
export async function transcribeWhisper(blob) {
  const file = new File([blob], "audio.webm", { type: "audio/webm" });
  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: form
  });
  if (!res.ok) throw new Error("Whisper HTTP " + res.status);
  const json = await res.json();
  return json.text.trim();
}

/* ---------- 3. tiny rule-based parser ---------- */
export function parseText(text) {
  const txt = text.toLowerCase();
  const rx = {
    patientName: "",
    medications: [{ name: "", dosage: "", frequency: "", duration: "", instructions: "" }],
    notes: text,
    date: new Date().toISOString().split("T")[0]
  };
  const re = {
    name: /patient[:\s]*([a-z\s]+?)(?:[,.]|$)/,
    med:  /(\w+.*?)\s+(\d+\s*(?:mg|ml|g|units?))/,
    freq: /(once|twice|three times|daily|every \d+ hours?|bid|tid|qid)/,
    dur:  /for\s*(\d+\s*(?:days?|weeks?|months?))/
  };
  let m;
  if ((m = txt.match(re.name))) rx.patientName = m[1].trim().title();
  if ((m = txt.match(re.med))) {
    rx.medications[0].name = m[1].trim().title();
    rx.medications[0].dosage = m[2];
  }
  if ((m = txt.match(re.freq))) rx.medications[0].frequency = m[0];
  if ((m = txt.match(re.dur))) rx.medications[0].duration = m[1];
  return rx;
}

/* ---------- 4. fill form ---------- */
export function fillForm(rx) {
  $("#patientName").value = rx.patientName;
  const med = rx.medications[0];
  $(".medication-name").value = med.name;
  $(".medication-dosage").value = med.dosage;
  $(".medication-frequency").value = med.frequency;
  $(".medication-duration").value = med.duration;
  $(".medication-instructions").value = med.instructions;
  $("#prescriptionNotes").value = rx.notes;
}

/* ---------- 5. dynamic meds ---------- */
export function addMedication() {
  const container = $("#medicationsContainer");
  const card = container.querySelector(".medication-card").cloneNode(true);
  card.querySelectorAll("input,textarea").forEach(i => (i.value = ""));
  container.appendChild(card);
}

/* ---------- 6. doctor info (localStorage) ---------- */
export function saveDoctorInfo() {
  const payload = {
    name: $("#doctorName").value,
    credentials: $("#credentials").value,
    license: $("#license").value,
    clinic: $("#clinicName").value,
    address: $("#address").value,
    phone: $("#phone").value,
    fax: $("#fax").value
  };
  localStorage.setItem("dr", JSON.stringify(payload));
  status("✅ Doctor info saved locally", "success");
  updateSignature();
}
export function loadDoctorInfo() {
  const raw = localStorage.getItem("dr");
  if (!raw) return;
  const data = JSON.parse(raw);
  Object.keys(data).forEach(k => {
    const el = document.getElementById(k);
    if (el) el.value = data[k];
  });
  updateSignature();
}
export function updateSignature() {
  $("#doctorSignature").textContent = `${$("#doctorName").value}, ${$("#credentials").value}`;
  $("#licenseInfo").textContent = $("#license").value;
  $("#clinicInfo").innerHTML = `${$("#clinicName").value}<br>${$("#address").value}<br>${$("#phone").value} | ${$("#fax").value}`;
}

/* ---------- 7. save prescription ---------- */
export function savePrescription() {
  const meds = [...$$(".medication-card")].map(card => ({
    name: card.querySelector(".medication-name").value,
    dosage: card.querySelector(".medication-dosage").value,
    frequency: card.querySelector(".medication-frequency").value,
    duration: card.querySelector(".medication-duration").value,
    instructions: card.querySelector(".medication-instructions").value
  })).filter(m => m.name);
  const payload = {
    doctor: {
      name: $("#doctorName").value,
      credentials: $("#credentials").value,
      license: $("#license").value,
      clinic: $("#clinicName").value
    },
    patient: { name: $("#patientName").value, date: $("#prescriptionDate").value },
    medications: meds,
    notes: $("#prescriptionNotes").value,
    timestamp: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "prescription_" + payload.patient.name.replace(/\s+/g, "_") + ".json" });
  a.click();
  URL.revokeObjectURL(url);
  status("✅ Prescription downloaded", "success");
}