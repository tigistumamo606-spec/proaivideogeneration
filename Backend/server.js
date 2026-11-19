
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { fal } from "@fal-ai/client";

dotenv.config();

if (!process.env.FAL_KEY) {
  throw new Error("FAL_KEY is missing from .env");
}

fal.config({
  credentials: process.env.FAL_KEY
});

const app = express();

app.use(cors());
app.use(express.json({ limit: "12mb" }));

const PORT = process.env.PORT || 3000;

const jobs = new Map();

const MODELS = {
  text: "minimax/h3-max-turbo/text-to-video",
  image: "minimax/h3-max-turbo/image-to-video"
};

app.get("/", (req, res) => {
  res.json({
    app: "Pro AI Video Generator",
    status: "Backend running"
  });
});

// Submit a video-generation request
app.post("/api/generate", async (req, res) => {
  try {
    const {
      mode,
      prompt,
      image,
      ratio,
      duration,
      resolution
    } = req.body;

    if (!MODELS[mode]) {
      return res.status(400).json({
        error: "Invalid generation mode."
      });
    }

    if (typeof prompt !== "string" ||
        !prompt.trim() ||
        prompt.length > 2000) {
      return res.status(400).json({
        error: "Enter a valid video prompt."
      });
    }

    if (mode === "image" &&
        (typeof image !== "string" ||
         !/^data:image\/(jpeg|png|webp);base64,/.test(image))) {
      return res.status(400).json({
        error: "A valid uploaded image is required."
      });
    }

    const allowedRatios = ["16:9", "9:16", "1:1", "4:3"];
    const allowedResolutions = ["480P", "768P", "1080P"];
    const allowedDurations = [5, 8, 10];

    if (!allowedRatios.includes(ratio) ||
        !allowedResolutions.includes(resolution) ||
        !allowedDurations.includes(Number(duration))) {
      return res.status(400).json({
        error: "Invalid video settings."
      });
    }

    const endpoint = MODELS[mode];

    const input = {
      prompt: prompt.trim(),
      duration: Number(duration),
      resolution,
      aspect_ratio: ratio,
      prompt_expansion_mode: "balanced",
      enable_safety_checker: true
    };

    if (mode === "image") {
      input.image_url = image;
    }

    const result = await fal.queue.submit(endpoint, {
      input
    });

    jobs.set(result.request_id, {
      endpoint,
      createdAt: Date.now()
    });

    res.json({
      success: true,
      jobId: result.request_id,
      status: result.status
    });

  } catch (error) {
    console.error("Generation error:", error.message);

    res.status(500).json({
      error: "Could not submit video generation. Check your API account and settings."
    });
  }
});

// Check generation progress
app.get("/api/status/:id", async (req, res) => {
  try {
    const job = jobs.get(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: "Job not found. It may have expired or the server restarted."
      });
    }

    const status = await fal.queue.status(job.endpoint, {
      requestId: req.params.id
    });

    if (status.status !== "COMPLETED") {
      return res.json({
        status: status.status
      });
    }

    const result = await fal.queue.result(job.endpoint, {
      requestId: req.params.id
    });

    const videoUrl = result.data?.video?.url;

    if (!videoUrl) {
      jobs.delete(req.params.id);

      return res.json({
        status: "COMPLETED",
        error: "The AI model did not return a video."
      });
    }

    jobs.delete(req.params.id);

    res.json({
      status: "COMPLETED",
      videoUrl
    });

  } catch (error) {
    console.error("Status error:", error.message);

    res.status(500).json({
      error: "Could not retrieve video result."
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Pro AI backend running on port ${PORT}`);
});
