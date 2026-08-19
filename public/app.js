const GOOGLE_CLIENT_ID =
  "388766707655-d07p5hatnr16v7sp6v9tqagkifgau460.apps.googleusercontent.com";
const GOOGLE_SHEET_ID =
  "1CmFmAYV8pZYvMFFz79r_0Z4fBu-iV4M85YQKmUldrbw";
const GOOGLE_DRIVE_FOLDER_ID =
  "1JCefW-ox01gbmvYNB1eBTkUSWRmxFY2v";
const GOOGLE_SHEET_TAB_NAME = "Sheet1";

const frontInput = document.getElementById("front-image");
const backInput = document.getElementById("back-image");
const scanner = document.getElementById("scanner");
const status = document.getElementById("status");
const googleStatus = document.getElementById("google-status");
const scanButton = document.getElementById("scan-button");
const connectGoogleButton = document.getElementById("connect-google-button");
const fieldButtons = document.querySelectorAll("[data-field]");

const results = document.getElementById("results");
const resultName = document.getElementById("result-name");
const resultNid = document.getElementById("result-nid");
const resultAddress = document.getElementById("result-address");
const resultEnglishAddress = document.getElementById(
  "result-english-address"
);

const cards = {
  front: {
    file: null,
    url: null,
    selections: {},
    preview: document.getElementById("front-preview"),
    layer: document.getElementById("front-selection-layer"),
  },
  back: {
    file: null,
    url: null,
    selections: {},
    preview: document.getElementById("back-preview"),
    layer: document.getElementById("back-selection-layer"),
  },
};

let selectedField = "englishName";
let drawingSide = null;
let startPoint = null;
let googleTokenClient = null;
let googleAccessToken = "";
let connectedStaffEmail = "";

function setSelectedField(field) {
  selectedField = field;

  fieldButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.field === field);
  });

  status.textContent = `Draw a box over the ${document.querySelector(
    `[data-field="${field}"]`
  ).textContent.toLowerCase()}.`;
}

function addImage(side, file) {
  const card = cards[side];

  if (card.url) URL.revokeObjectURL(card.url);

  card.file = file;
  card.url = URL.createObjectURL(file);
  card.preview.src = card.url;
  card.preview.hidden = false;
  card.selections = {};

  renderSelections(side);
  scanner.hidden = false;

  if (cards.front.file && cards.back.file) {
    status.textContent =
      "Both images are ready. Select a color and drag over name, NID, and address.";
  }
}

function renderSelections(side) {
  const card = cards[side];
  card.layer.innerHTML = "";

  Object.entries(card.selections).forEach(([field, box]) => {
    const element = document.createElement("div");

    element.className = `selection-box selection-${field}`;
    element.style.left = `${box.x}px`;
    element.style.top = `${box.y}px`;
    element.style.width = `${box.width}px`;
    element.style.height = `${box.height}px`;

    card.layer.appendChild(element);
  });
}

function pointFromEvent(layer, event) {
  const bounds = layer.getBoundingClientRect();

  return {
    x: Math.max(0, Math.min(event.clientX - bounds.left, bounds.width)),
    y: Math.max(0, Math.min(event.clientY - bounds.top, bounds.height)),
  };
}

function getBox(layer, endPoint) {
  return {
    x: Math.min(startPoint.x, endPoint.x),
    y: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y),
    displayWidth: layer.clientWidth,
    displayHeight: layer.clientHeight,
  };
}

function setupLayer(side) {
  const card = cards[side];
  const layer = card.layer;

  layer.addEventListener("pointerdown", (event) => {
    if (!card.file) return;

    drawingSide = side;
    startPoint = pointFromEvent(layer, event);
    layer.setPointerCapture(event.pointerId);
  });

  layer.addEventListener("pointermove", (event) => {
    if (drawingSide !== side) return;

    card.selections[selectedField] = getBox(
      layer,
      pointFromEvent(layer, event)
    );

    renderSelections(side);
  });

  function finish(event) {
    if (drawingSide !== side) return;

    drawingSide = null;
    const box = getBox(layer, pointFromEvent(layer, event));

    if (box.width < 5 || box.height < 5) {
      delete card.selections[selectedField];
      status.textContent = "Click and drag to create a box.";
    } else {
      card.selections[selectedField] = box;
      status.textContent = `Saved ${selectedField} selection on the ${side} card.`;
    }

    renderSelections(side);
  }

  layer.addEventListener("pointerup", finish);
  layer.addEventListener("pointercancel", finish);
}

setupLayer("front");
setupLayer("back");

frontInput.addEventListener("change", () => {
  if (frontInput.files[0]) addImage("front", frontInput.files[0]);
});

backInput.addEventListener("change", () => {
  if (backInput.files[0]) addImage("back", backInput.files[0]);
});

fieldButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setSelectedField(button.dataset.field);
  });
});

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function cropImage(image, box) {
  const scaleX = image.naturalWidth / box.displayWidth;
  const scaleY = image.naturalHeight / box.displayHeight;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(box.width * scaleX));
  canvas.height = Math.max(1, Math.round(box.height * scaleY));

  canvas.getContext("2d").drawImage(
    image,
    Math.round(box.x * scaleX),
    Math.round(box.y * scaleY),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvas;
}

async function readText(source, language, label) {
  const result = await Tesseract.recognize(source, language, {
    logger: (message) => {
      if (message.status === "recognizing text") {
        status.textContent = `${label}: ${Math.round(message.progress * 100)}%`;
      }
    },
  });

  return result.data.text.trim();
}

function cleanName(text) {
  const cleaned = text
    .toUpperCase()
    .replace(/[«‹]/g, "<")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.includes("<<")) {
    const parts = cleaned
      .replace(/<+$/g, "")
      .split("<<")
      .map((part) => part.replace(/<+/g, " ").trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      return `${parts.slice(1).join(" ")} ${parts[0]}`.trim();
    }
  }

  return cleaned
    .replace(/\b(?:NAME|NMAE|NANE)\b\s*[:.-]*/g, "")
    .replace(/[^A-Z.' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanNid(text) {
  const normalized = text
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/Q/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/Z/g, "2")
    .replace(/S/g, "5")
    .replace(/B/g, "8");

  const marker = normalized.match(/[I1]<BGD/);

  if (marker) {
    const afterBGD = normalized.slice(marker.index + marker[0].length);
    return afterBGD.replace(/\D/g, "").slice(0, 10);
  }

  return normalized.replace(/\D/g, "").slice(0, 17);
}

async function translateAddress(banglaAddress) {
  if (!banglaAddress || !("Translator" in self)) return "";

  const availability = await Translator.availability({
    sourceLanguage: "bn",
    targetLanguage: "en",
  });

  if (availability === "unavailable") return "";

  const translator = await Translator.create({
    sourceLanguage: "bn",
    targetLanguage: "en",
  });

  const translation = await translator.translate(banglaAddress);

  if (typeof translator.destroy === "function") translator.destroy();

  return translation;
}

function findSelection(field) {
  for (const side of ["front", "back"]) {
    if (cards[side].selections[field]) {
      return { side, box: cards[side].selections[field] };
    }
  }

  return null;
}

scanButton.addEventListener("click", async () => {
  if (!cards.front.file || !cards.back.file) {
    status.textContent = "Upload both images first.";
    return;
  }

  const nameSelection = findSelection("englishName");
  const nidSelection = findSelection("nidNumber");
  const addressSelection = findSelection("address");

  if (!nameSelection || !nidSelection || !addressSelection) {
    status.textContent =
      "Draw one box each for English name, NID number, and Bangla address.";
    return;
  }

  scanButton.disabled = true;

  try {
    const images = {
      front: await loadImage(cards.front.url),
      back: await loadImage(cards.back.url),
    };

    const nameText = await readText(
      cropImage(images[nameSelection.side], nameSelection.box),
      "eng",
      "Reading name"
    );

    const nidText = await readText(
      cropImage(images[nidSelection.side], nidSelection.box),
      "eng",
      "Reading NID"
    );

    const addressText = await readText(
      cropImage(images[addressSelection.side], addressSelection.box),
      "eng+ben",
      "Reading address"
    );

    const englishName = cleanName(nameText);
    const nidNumber = cleanNid(nidText);
    const banglaAddress = addressText;

    if (!englishName || !nidNumber) {
      throw new Error("The name or NID crop was not read clearly.");
    }

    let englishAddress = "";

    try {
      status.textContent = "Translating address to English…";
      englishAddress = await translateAddress(banglaAddress);
    } catch (error) {
      console.warn(error);
    }

    resultName.textContent = englishName;
    resultNid.textContent = nidNumber;
    resultAddress.textContent = banglaAddress;
    resultEnglishAddress.textContent =
      englishAddress || "Translation unavailable in this browser.";
    results.hidden = false;

    await saveToGoogle({
      englishName,
      nidNumber,
      banglaAddress,
      englishAddress,
    });

    status.textContent = "Saved successfully to Google Sheets and Drive.";
  } catch (error) {
    console.error(error);
    status.textContent =
      error.message || "Scanning could not finish. Adjust the boxes and try again.";
  } finally {
    scanButton.disabled = false;
  }
});

function getGoogleTokenClient() {
  if (googleTokenClient) return googleTokenClient;

  googleTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope:
      "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email",
    callback: () => {},
  });

  return googleTokenClient;
}

function connectGoogle() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google sign-in is still loading."));
      return;
    }

    const client = getGoogleTokenClient();

    client.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error));
        return;
      }

      googleAccessToken = response.access_token;
      resolve();
    };

    client.requestAccessToken({ prompt: "consent" });
  });
}

connectGoogleButton.addEventListener("click", async () => {
  try {
    googleStatus.textContent = "Connecting…";
    await connectGoogle();
    googleStatus.textContent = "Google account connected.";
  } catch (error) {
    googleStatus.textContent = "Google account could not connect.";
  }
});

async function uploadToDrive(file, side, record) {
  if (!googleAccessToken) {
    throw new Error("Connect your staff Google account before saving.");
  }

  const boundary = `ikormi-${crypto.randomUUID()}`;
  const metadata = {
    name: `${record.nidNumber}-${side}-${Date.now()}.${file.name.split(".").pop()}`,
    parents: [GOOGLE_DRIVE_FOLDER_ID],
    mimeType: file.type,
  };

  const body = new Blob(
    [
      `--${boundary}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      `Content-Type: ${file.type}\r\n\r\n`,
      file,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` }
  );

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${googleAccessToken}` },
      body,
    }
  );

  if (!response.ok) throw new Error("Google Drive upload failed.");

  const data = await response.json();
  return `https://drive.google.com/open?id=${data.id}`;
}

async function saveToGoogle(record) {
  const frontUrl = await uploadToDrive(cards.front.file, "front", record);
  const backUrl = await uploadToDrive(cards.back.file, "back", record);
  const range = encodeURIComponent(`${GOOGLE_SHEET_TAB_NAME}!A:H`);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [
          [
            new Date().toLocaleString(),
            record.englishName,
            record.nidNumber,
            record.banglaAddress,
            record.englishAddress,
            `=HYPERLINK("${frontUrl}","Open front photo")`,
            `=HYPERLINK("${backUrl}","Open back photo")`,
            "Staff upload",
          ],
        ],
      }),
    }
  );

  if (!response.ok) throw new Error("Google Sheets save failed.");
}

setSelectedField("englishName");