# Setup Game Thumbnails

To use the game thumbnails, you need to copy the images to the correct location:

1. Create the thumbnails directory:
   ```
   mkdir src\assets\thumbnails
   ```

2. Copy the images from the assets folder to the thumbnails directory:
   - Copy `image-ffa9d0b8-624c-478a-ae3b-f31cf509fe59.png` → `src\assets\thumbnails\blackjack.png`
   - Copy `image-d2142276-228e-408d-9559-6db00823f0f0.png` → `src\assets\thumbnails\minesweeper.png`
   - Copy `image-f853af10-607c-42e8-b07e-a60bc9aed5a4.png` → `src\assets\thumbnails\tictactoe.png`

The images are located at:
`C:\Users\Aarush\.cursor\projects\c-Users-Aarush-Desktop-Neu\assets\`

Alternatively, you can manually copy them using Windows Explorer or use PowerShell:
```powershell
New-Item -ItemType Directory -Force -Path "src\assets\thumbnails"
Copy-Item "C:\Users\Aarush\.cursor\projects\c-Users-Aarush-Desktop-Neu\assets\image-ffa9d0b8-624c-478a-ae3b-f31cf509fe59.png" "src\assets\thumbnails\blackjack.png"
Copy-Item "C:\Users\Aarush\.cursor\projects\c-Users-Aarush-Desktop-Neu\assets\image-d2142276-228e-408d-9559-6db00823f0f0.png" "src\assets\thumbnails\minesweeper.png"
Copy-Item "C:\Users\Aarush\.cursor\projects\c-Users-Aarush-Desktop-Neu\assets\image-f853af10-607c-42e8-b07e-a60bc9aed5a4.png" "src\assets\thumbnails\tictactoe.png"
```
