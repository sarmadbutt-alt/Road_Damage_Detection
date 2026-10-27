# RoadVision AI — Frontend starter

This is a responsive HTML/CSS/JavaScript frontend for the road damage segmentation project.

## Files
- `templates/index.html`
- `static/css/style.css`
- `static/js/script.js`

## Add to your Flask project
Copy the `templates` and `static` folders into the same directory as your `app.py`. If those folders already exist, merge the files carefully rather than deleting your existing files.

## Backend contract expected by the frontend
The Analyze button sends:
- `POST /predict`
- multipart/form-data field named `image`

The endpoint should return JSON similar to:
```json
{
  "original_url": "/static/results/original_abc123.png",
  "mask_url": "/static/results/mask_abc123.png",
  "overlay_url": "/static/results/overlay_abc123.png",
  "message": "Prediction complete."
}
```
The `mask_url` and `overlay_url` fields are required. `original_url` and `message` are optional.

This frontend does not train or load the model itself. Flask must load the saved `.keras` model and implement `/predict`. The frontend will display a clear error if that endpoint is not ready.

## Run
From your Flask project folder, after `app.py` has been created:
```bash
python app.py
```
Then open the local URL printed by Flask, commonly `http://127.0.0.1:5000`.

Note: The page references Google Fonts for typography; if you are offline, it will fall back to local sans-serif fonts.
