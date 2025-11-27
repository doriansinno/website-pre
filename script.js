// BloodCheck Hauptlogik – pure JavaScript
// -------------------------------------------------------------
// Kommentarlegende (Anpassungen):
// 1) Referenzwerte pflegen: refData ganz unten in "profiles" anpassen (min/max je Geschlecht).
// 2) Neue Profile ergänzen: in profiles{} neuen Schlüssel mit Werten anlegen (siehe Kommentar in profiles).
// 3) Farblogik ändern: Funktion getStatus() und CSS-Klassen .badge.low/normal/high in style.css.
// 4) PDF-Inhalt anpassen: Funktion generatePdf(), Bereich "content" und Reihenfolge modifizieren.
// 5) Diagramm erweitern: setupChart() Datensätze oder Farben ergänzen; updateChartCounts() kontrolliert die Zahlen.
// 6) Animation tauschen: siehe style.css Kommentar bei .ekg-line (CSS/SVG austauschbar).

const genderSelect = document.getElementById('gender');
const profileSelect = document.getElementById('profile');
const valuesContainer = document.getElementById('values-container');
const downloadBtn = document.getElementById('downloadPdf');
let chartInstance;

const profiles = {
  // REFERENZWERTE hier pflegen – min/max je Geschlecht anpassen oder erweitern
  basic: {
    label: 'Kleines Blutbild',
    values: {
      wbc: { name: 'Leukozyten (WBC)', unit: 'G/L', ref: { male: [4, 10], female: [4, 10] }, desc: 'Immunabwehr gegen Infektionen.' },
      rbc: { name: 'Erythrozyten (RBC)', unit: 'T/L', ref: { male: [4.5, 6], female: [4.0, 5.4] }, desc: 'Transportiert Sauerstoff und CO₂.' },
      hb: { name: 'Hämoglobin (HB)', unit: 'g/dL', ref: { male: [14, 18], female: [12, 16] }, desc: 'Bindet und transportiert Sauerstoff.' },
      hkt: { name: 'Hämatokrit (HKT)', unit: '%', ref: { male: [40, 54], female: [36, 48] }, desc: 'Anteil zellulärer Bestandteile am Blutvolumen.' },
      plt: { name: 'Thrombozyten (PLT)', unit: 'G/L', ref: { male: [150, 400], female: [150, 400] }, desc: 'Zuständig für Blutgerinnung und Wundverschluss.' },
    },
  },
  extended: {
    label: 'Großes Blutbild',
    // Weitere Werte ergänzen, Struktur wie oben
    values: {
      wbc: { name: 'Leukozyten (WBC)', unit: 'G/L', ref: { male: [4, 10], female: [4, 10] }, desc: 'Immunabwehr gegen Infektionen.' },
      neut: { name: 'Neutrophile', unit: '%', ref: { male: [40, 75], female: [40, 75] }, desc: 'Erste Abwehrlinie gegen Bakterien.' },
      lymph: { name: 'Lymphozyten', unit: '%', ref: { male: [20, 45], female: [20, 45] }, desc: 'Adaptive Immunantwort.' },
      hb: { name: 'Hämoglobin (HB)', unit: 'g/dL', ref: { male: [14, 18], female: [12, 16] }, desc: 'Bindet und transportiert Sauerstoff.' },
      ferritin: { name: 'Ferritin', unit: 'ng/mL', ref: { male: [30, 400], female: [15, 150] }, desc: 'Eisenspeicher und Frühmarker für Mangel.' },
      crp: { name: 'CRP', unit: 'mg/L', ref: { male: [0, 5], female: [0, 5] }, desc: 'Marker für akute Entzündungen.' },
    },
  },
  hormone: {
    label: 'Hormonprofil',
    values: {
      tsh: { name: 'TSH', unit: 'mIU/L', ref: { male: [0.4, 4.0], female: [0.4, 4.0] }, desc: 'Steuert die Schilddrüsenfunktion.' },
      fT4: { name: 'Freies T4', unit: 'ng/dL', ref: { male: [0.8, 1.8], female: [0.8, 1.8] }, desc: 'Aktives Schilddrüsenhormon.' },
      testo: { name: 'Testosteron', unit: 'ng/mL', ref: { male: [2.5, 8.5], female: [0.1, 0.9] }, desc: 'Beeinflusst Energie, Muskeln und Libido.' },
      estradiol: { name: 'Östradiol', unit: 'pg/mL', ref: { male: [10, 60], female: [30, 350] }, desc: 'Reguliert Zyklus, Knochenstoffwechsel und Stimmung.' },
      vitD: { name: 'Vitamin D (25-OH)', unit: 'ng/mL', ref: { male: [30, 60], female: [30, 60] }, desc: 'Knochenstoffwechsel und Immunbalance.' },
    },
  },
  vital: {
    label: 'Vitalprofil',
    values: {
      glucose: { name: 'Glukose nüchtern', unit: 'mg/dL', ref: { male: [70, 100], female: [70, 100] }, desc: 'Energieversorgung und Stoffwechsel.' },
      hba1c: { name: 'HbA1c', unit: '%', ref: { male: [4, 5.6], female: [4, 5.6] }, desc: 'Durchschnittlicher Blutzucker der letzten 8–12 Wochen.' },
      chol: { name: 'Gesamtcholesterin', unit: 'mg/dL', ref: { male: [120, 200], female: [120, 200] }, desc: 'Fettstoffwechsel und kardiovaskuläres Risiko.' },
      hdl: { name: 'HDL', unit: 'mg/dL', ref: { male: [40, 80], female: [50, 90] }, desc: 'Schützendes Cholesterin, Transport zum Abbau.' },
      ldl: { name: 'LDL', unit: 'mg/dL', ref: { male: [0, 130], female: [0, 120] }, desc: '„Schlechtes" Cholesterin, Ablagerungen in Gefäßen.' },
    },
  },
};

function getStatus(value, [min, max]) {
  if (value === '') return { status: 'normal', label: 'Wert fehlt' };
  const numeric = parseFloat(value);
  if (Number.isNaN(numeric)) return { status: 'normal', label: 'Keine Zahl' };
  if (numeric < min) return { status: 'low', label: 'Zu niedrig' };
  if (numeric > max) return { status: 'high', label: 'Zu hoch' };
  return { status: 'normal', label: 'Im Soll' };
}

function renderValues() {
  if (!valuesContainer) return;
  valuesContainer.innerHTML = '';
  const profileKey = profileSelect.value;
  const genderKey = genderSelect.value;
  const profile = profiles[profileKey];

  Object.entries(profile.values).forEach(([key, val]) => {
    const range = val.ref[genderKey] || val.ref.male;
    const row = document.createElement('div');
    row.className = 'value-row';
    row.innerHTML = `
      <div>
        <span class="label">${val.name}</span>
        <small style="color: var(--muted);">Referenz: ${range[0]} – ${range[1]} ${val.unit}</small>
      </div>
      <div>
        <input class="input" type="number" step="any" data-key="${key}" placeholder="Wert eingeben" />
      </div>
      <div>
        <span class="badge normal" data-result="${key}">Im Soll</span>
      </div>
      <p class="description">${val.desc}</p>
    `;
    valuesContainer.appendChild(row);
  });
}

function evaluateInputs() {
  if (!valuesContainer) return { low: 0, normal: 0, high: 0 };
  const profileKey = profileSelect.value;
  const genderKey = genderSelect.value;
  const profile = profiles[profileKey];
  const counts = { low: 0, normal: 0, high: 0 };

  const inputs = valuesContainer.querySelectorAll('input[data-key]');
  inputs.forEach((input) => {
    const key = input.dataset.key;
    const refRange = profile.values[key].ref[genderKey] || profile.values[key].ref.male;
    const { status, label } = getStatus(input.value, refRange);
    const badge = valuesContainer.querySelector(`[data-result="${key}"]`);
    badge.className = `badge ${status}`;
    badge.textContent = label;
    counts[status] += 1;
  });

  updateChartCounts(counts);
  return counts;
}

function setupChart() {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Zu niedrig', 'Normal', 'Zu hoch'],
      datasets: [
        {
          label: 'Status',
          data: [0, 0, 0],
          backgroundColor: ['rgba(29,78,216,0.6)', 'rgba(31,170,89,0.6)', 'rgba(185,28,28,0.7)'],
          borderColor: 'rgba(201,166,70,0.45)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: { labels: { color: '#e6e6e6' } },
      },
      cutout: '65%',
    },
  });
}

function updateChartCounts(counts) {
  if (!chartInstance) return;
  chartInstance.data.datasets[0].data = [counts.low, counts.normal, counts.high];
  chartInstance.update();
}

function generatePdf() {
  if (!downloadBtn) return;
  const doc = new jspdf.jsPDF();
  const profileName = profiles[profileSelect.value].label;
  const genderName = genderSelect.value === 'male' ? 'Mann' : 'Frau';
  const date = new Date().toLocaleString('de-DE');

  // PDF-INHALT HIER ANPASSEN: Reihenfolge, Texte oder Layout ändern
  doc.setFontSize(14);
  doc.text('BloodCheck – Analyse', 14, 18);
  doc.setFontSize(10);
  doc.text(`Datum: ${date}`, 14, 26);
  doc.text(`Profil: ${profileName}`, 14, 32);
  doc.text(`Geschlecht: ${genderName}`, 14, 38);

  let y = 48;
  const counts = evaluateInputs();
  const profile = profiles[profileSelect.value];
  doc.text('Ergebnisse:', 14, y);
  y += 6;
  Object.entries(profile.values).forEach(([key, val]) => {
    const ref = val.ref[genderSelect.value];
    const input = valuesContainer.querySelector(`input[data-key="${key}"]`).value;
    const status = valuesContainer.querySelector(`[data-result="${key}"]`).textContent;
    doc.text(`${val.name}: ${input || '–'} ${val.unit} (${status})`, 14, y);
    doc.text(`Referenz: ${ref[0]} – ${ref[1]} ${val.unit}`, 14, y + 5);
    y += 12;
  });

  doc.text('Zusammenfassung:', 14, y);
  doc.text(`Zu niedrig: ${counts.low}`, 14, y + 6);
  doc.text(`Normal: ${counts.normal}`, 14, y + 12);
  doc.text(`Zu hoch: ${counts.high}`, 14, y + 18);

  doc.save('BloodCheck-Analyse.pdf');
}

function init() {
  if (!valuesContainer || !profileSelect || !genderSelect) return;
  renderValues();
  setupChart();
  evaluateInputs();

  profileSelect.addEventListener('change', () => {
    renderValues();
    evaluateInputs();
  });

  genderSelect.addEventListener('change', () => {
    renderValues();
    evaluateInputs();
  });

  valuesContainer.addEventListener('input', () => evaluateInputs());
  if (downloadBtn) downloadBtn.addEventListener('click', generatePdf);
}

document.addEventListener('DOMContentLoaded', init);
