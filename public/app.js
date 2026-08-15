const form = document.getElementById("scan-form");
const imageInput = document.getElementById("nid-image");
const imagePreview = document.getElementById("image-preview");
const scanButton = document.getElementById("scan-button");
const status = document.getElementById("status");
const reviewCard = document.getElementById("review-card");
const nameInput = document.getElementById("name");
const nidNumberInput = document.getElementById("nid-number");

imageInput.addEventListener("change", () => {
  const [file] = imageInput.files;

  if (!file) {
    imagePreview.hidden = true;
    imagePreview.src = "";
    return;
  }

  imagePreview.src = URL.createObjectURL(file);
  imagePreview.hidden = false;
  status.textContent = `Selected: ${file.name}`;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const [file] = imageInput.files;

  if (!file) {
    status.textContent = "Please choose an image first.";
    return;
  }

  scanButton.disabled = true;
  scanButton.textContent = "Scanning…";
  status.textContent = "Sending image securely for processing…";

  try {
    const formData = new FormData();
    formData.append("nidImage", file);

    const response = await fetch("/api/scan", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The scan could not be completed.");
    }

    nameInput.value = data.extracted.name || "";
    nidNumberInput.value = data.extracted.nidNumber || "";
    reviewCard.hidden = false;
    status.textContent = data.message;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    scanButton.disabled = false;
    scanButton.textContent = "Scan card";
  }
});