(() => {
  const input = document.getElementById("image-input");
  const dropZone = document.getElementById("drop-zone");
  const form = document.getElementById("upload-form");
  const analyzeButton = document.getElementById("analyze-button");
  const buttonText = analyzeButton.querySelector(".button-text");
  const resetButton = document.getElementById("reset-button");
  const removeButton = document.getElementById("remove-image");
  const selectedFile = document.getElementById("selected-file");
  const fileName = document.getElementById("file-name");
  const fileSize = document.getElementById("file-size");
  const previewWrap = document.getElementById("preview-wrap");
  const imagePreview = document.getElementById("image-preview");
  const emptyResults = document.getElementById("empty-results");
  const loadingResults = document.getElementById("loading-results");
  const resultsContent = document.getElementById("results-content");
  const errorMessage = document.getElementById("error-message");
  const resultStatus = document.getElementById("result-status");
  const resultMessage = document.getElementById("result-message");
  let selectedImage = null;
  let previewUrl = null;

  const MAX_SIZE = 16 * 1024 * 1024;
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"];

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
  }
  function clearError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
  }
  function setStatus(text, active = false) {
    resultStatus.innerHTML = `<span class="status-dot ${active ? "" : "muted"}"></span> ${text}`;
  }
  function showView(view) {
    emptyResults.classList.toggle("hidden", view !== "empty");
    loadingResults.classList.toggle("hidden", view !== "loading");
    resultsContent.classList.toggle("hidden", view !== "results");
  }
  function formatSize(bytes) {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  function chooseFile(file) {
    clearError();
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      showError("Please choose a JPG, PNG, WEBP, or BMP image.");
      return;
    }
    if (file.size > MAX_SIZE) {
      showError("This image is larger than 16 MB. Please choose a smaller image.");
      return;
    }
    selectedImage = file;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    imagePreview.src = previewUrl;
    fileName.textContent = file.name;
    fileSize.textContent = formatSize(file.size);
    selectedFile.classList.remove("hidden");
    previewWrap.classList.remove("hidden");
    dropZone.classList.add("hidden");
    analyzeButton.disabled = false;
    showView("empty");
    setStatus("READY", true);
  }
  function clearSelection() {
    selectedImage = null;
    input.value = "";
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    imagePreview.removeAttribute("src");
    selectedFile.classList.add("hidden");
    previewWrap.classList.add("hidden");
    dropZone.classList.remove("hidden");
    analyzeButton.disabled = true;
    buttonText.textContent = "Analyze road image";
    clearError();
    showView("empty");
    setStatus("WAITING");
  }

  dropZone.addEventListener("click", () => input.click());
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", () => chooseFile(input.files[0]));
  ["dragenter", "dragover"].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(type => dropZone.addEventListener(type, event => {
    event.preventDefault();
    dropZone.classList.remove("dragover");
  }));
  dropZone.addEventListener("drop", event => chooseFile(event.dataTransfer.files[0]));
  removeButton.addEventListener("click", clearSelection);
  resetButton.addEventListener("click", clearSelection);

  form.addEventListener("submit", async event => {
    event.preventDefault();
    clearError();
    if (!selectedImage) {
      showError("Choose a road image first.");
      return;
    }
    const formData = new FormData();
    formData.append("image", selectedImage);
    analyzeButton.disabled = true;
    buttonText.textContent = "Analyzing…";
    showView("loading");
    setStatus("PROCESSING", true);

    try {
      // Flask backend contract: POST /predict with multipart field "image".
      // Expected JSON: { original_url, mask_url, overlay_url }.
      const response = await fetch("/predict", { method: "POST", body: formData });
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok) {
        throw new Error(payload.error || payload.message || `Server error (${response.status}).`);
      }
      if (!payload.mask_url || !payload.overlay_url) {
        throw new Error("The server response is missing mask_url or overlay_url. Check the Flask /predict response format.");
      }

      document.getElementById("original-result").src = payload.original_url || previewUrl;
      document.getElementById("mask-result").src = payload.mask_url;
      document.getElementById("overlay-result").src = payload.overlay_url;
      document.getElementById("download-mask").href = payload.mask_url;
      document.getElementById("download-overlay").href = payload.overlay_url;
      resultMessage.textContent = payload.message || "Prediction complete. Review the highlighted regions.";
      showView("results");
      setStatus("COMPLETE", true);
    } catch (error) {
      showView("empty");
      setStatus("ERROR");
      showError(`Could not complete analysis. ${error.message || "Check that your Flask server is running and the /predict endpoint is configured."}`);
    } finally {
      analyzeButton.disabled = !selectedImage;
      buttonText.textContent = "Analyze road image";
    }
  });
})();