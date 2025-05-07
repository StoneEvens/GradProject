from django.shortcuts import redirect, render
from django.core.files.uploadedfile import InMemoryUploadedFile
from google.cloud import vision
from google.oauth2 import service_account

def index(request, *args, **kwargs):
    # Retrieve the message from the session
    message = request.session.pop('message', None)  # Remove the message after retrieving it
    return render(request, 'ocrtest/index.html', {'message': message})

def upload(request, *args, **kwargs):
    if request.method == 'POST':
        credentials_path = "D:/Shared/ai-project-454107-a1e8b881803e.json"  # Path to your Google JSON

        # Check if an image file is uploaded
        if 'image' not in request.FILES:
            request.session['message'] = 'No image uploaded.'
            return redirect('/ocrtest/')

        uploaded_image = request.FILES['image']  # Get the uploaded image
        if not isinstance(uploaded_image, InMemoryUploadedFile):
            request.session['message'] = 'Invalid file type.'
            return redirect('/ocrtest/')

        credentials = service_account.Credentials.from_service_account_file(credentials_path)
        client = vision.ImageAnnotatorClient(credentials=credentials)

        # Read the uploaded image content
        content = uploaded_image.read()
        image = vision.Image(content=content)

        response = client.text_detection(image=image)
        texts = response.text_annotations

        if response.error.message:
            request.session['message'] = f"Error: {response.error.message}"
        elif not texts:
            request.session['message'] = "No text found."
        else:
            request.session['message'] = texts[0].description  # Extracted text

        return redirect('/ocrtest/')

    return render(request, 'ocrtest/index.html')