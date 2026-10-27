
from flask import Flask, render_template, request, jsonify
from pathlib import Path
from PIL import Image
import tensorflow as tf
import numpy as np
import cv2
import uuid

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "Model" / "best_model.keras"
RESULTS_DIR = BASE_DIR / "static" / "results"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# Load the already-trained model. No training takes place here.
model = tf.keras.models.load_model(
    MODEL_PATH,
    compile=False
)

print("Road damage model loaded successfully!")
print("Input shape:", model.input_shape)
print("Output shape:", model.output_shape)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        if "image" not in request.files:
            return jsonify({"error": "Please upload an image."}), 400

        file = request.files["image"]

        if not file.filename:
            return jsonify({"error": "No image selected."}), 400

        # Read and validate the image
        try:
            image = Image.open(file.stream).convert("RGB")
        except Exception:
            return jsonify({"error": "Please upload a valid image."}), 400

        original = np.array(image)
        original_bgr = cv2.cvtColor(original, cv2.COLOR_RGB2BGR)

        # Prepare the input using the training image size and normalization
        input_h = model.input_shape[1]
        input_w = model.input_shape[2]

        resized = cv2.resize(
            original,
            (input_w, input_h),
            interpolation=cv2.INTER_LINEAR
        )

        normalized = resized.astype(np.float32) / 255.0
        batch = np.expand_dims(normalized, axis=0)

        # Predict damage mask
        prediction = model.predict(batch, verbose=0)[0, :, :, 0]

        # Threshold converts probabilities into a binary mask.
        # 0.2 is a starting point based on your earlier validation test.
        mask_small = (prediction >= 0.2).astype(np.uint8) * 255

        # Resize the mask back to the original image dimensions
        mask = cv2.resize(
            mask_small,
            (original.shape[1], original.shape[0]),
            interpolation=cv2.INTER_NEAREST
        )

        # Create a red overlay where damage is predicted
        overlay = original.copy()
        overlay[mask > 0] = (
            0.55 * overlay[mask > 0]
            + 0.45 * np.array([255, 0, 0])
        ).astype(np.uint8)

        # Save unique result filenames
        result_id = uuid.uuid4().hex

        original_name = f"original_{result_id}.png"
        mask_name = f"mask_{result_id}.png"
        overlay_name = f"overlay_{result_id}.png"

        cv2.imwrite(
            str(RESULTS_DIR / original_name),
            original_bgr
        )
        cv2.imwrite(
            str(RESULTS_DIR / mask_name),
            mask
        )
        cv2.imwrite(
            str(RESULTS_DIR / overlay_name),
            cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR)
        )

        return jsonify({
            "original_url": f"/static/results/{original_name}",
            "mask_url": f"/static/results/{mask_name}",
            "overlay_url": f"/static/results/{overlay_name}",
            "message": "Prediction complete."
        })

    except Exception as error:
        app.logger.exception("Prediction failed")
        return jsonify({
            "error": "Prediction failed. Check the Flask terminal for details."
        }), 500


@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None
    })


if __name__ == "__main__":
    app.run(debug=True)
