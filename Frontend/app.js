
const API = "http://127.0.0.1:3000";

let mode = "text";
let imageData = null;

const form = document.getElementById("generatorForm");
const promptInput = document.getElementById("prompt");
const imageInput = document.getElementById("imageInput");
const imagePreview = document.getElementById("imagePreview");
const imageField = document.getElementById("imageField");
const generateBtn = document.getElementById("generateBtn");
const videoPlayer = document.getElementById("videoPlayer");
const progressArea = document.getElementById("progressArea");
const progressText = document.getElementById("progressText");

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;

    document.querySelectorAll(".tab").forEach(tab => {
      tab.classList.toggle("active", tab === button);
    });

    imageField.hidden = mode !== "image";
  });
});

promptInput.addEventListener("input", () => {
  document.getElementById("charCount").textContent =
    `${promptInput.value.length} / 2000`;
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];

  if (!file) return;

  if (file.size > 6 * 1024 * 1024) {
    alert("Image must be smaller than 6 MB.");
    imageInput.value = "";
    return;
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    alert("Please choose JPG, PNG or WEBP.");
    imageInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    imageData = reader.result;
    imagePreview.src = imageData;
    imagePreview.hidden = false;
  };

  reader.readAsDataURL(file);
});

function showProgress(message) {
  progressArea.hidden = false;
  progressText.textContent = message;
}

function setLoading(loading) {
  generateBtn.disabled = loading;
  generateBtn.textContent = loading
    ? "Generating..."
    : "✦ Generate AI Video";
}

function showVideo(url) {
  document.getElementById("emptyState").hidden = true;
  videoPlayer.src = url;
  videoPlayer.hidden = false;

  const downloadBtn = document.getElementById("downloadBtn");
  downloadBtn.href = url;

  document.getElementById("resultActions").hidden = false;
  progressArea.hidden = true;

  saveHistory(url);
}

function saveHistory(url) {
  let history = JSON.parse(
    localStorage.getItem("proVideoHistory") || "[]"
  );

  history.unshift({
    url,
    date: new Date().toLocaleString()
  });

  history = history.slice(0, 10);

  localStorage.setItem("proVideoHistory", JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = JSON.parse(
    localStorage.getItem("proVideoHistory") || "[]"
  );

  const list = document.getElementById("historyList");

  if (!history.length) {
    list.innerHTML = '<p class="muted">No videos generated yet.</p>';
    return;
  }

  list.replaceChildren();

  history.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";

    const date = document.createElement("small");
    date.textContent = item.date;

    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open generated video";

    div.append(date, link);
    list.appendChild(div);
  });
}

async function checkJob(jobId) {
  while (true) {
    const response = await fetch(
      `${API}/api/status/${encodeURIComponent(jobId)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not check generation.");
    }

    if (data.status === "COMPLETED") {
      if (!data.videoUrl) {
        throw new Error(data.error || "Video generation failed.");
      }

      showVideo(data.videoUrl);
      return;
    }

    showProgress(
      data.status === "IN_PROGRESS"
        ? "AI is creating your video..."
        : "Your video is waiting in the AI queue..."
    );

    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();

  const prompt = promptInput.value.trim();

  if (!prompt) {
    alert("Please write a video prompt.");
    return;
  }

  if (mode === "image" && !imageData) {
    alert("Please upload an image first.");
    return;
  }

  setLoading(true);
  showProgress("Submitting your request...");
  document.getElementById("resultActions").hidden = true;

  try {
    const response = await fetch(`${API}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode,
        prompt,
        image: mode === "image" ? imageData : null,
        ratio: document.getElementById("ratio").value,
        duration: Number(
          document.getElementById("duration").value
        ),
        resolution: document.getElementById("resolution").value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Request failed.");
    }

    await checkJob(data.jobId);

  } catch (error) {
    alert(error.message);
    progressArea.hidden = true;
  } finally {
    setLoading(false);
  }
});

renderHistory();
