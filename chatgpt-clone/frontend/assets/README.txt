This folder is reserved for static images (e.g. a custom robot.png).

By default the app uses the 🤖 emoji for the robot avatar so it works
out of the box with zero extra assets. If you'd like a custom
illustration instead:

1. Drop your image in this folder, e.g. assets/robot.png
2. In frontend/index.html, replace:
     <div class="robot-avatar-large" aria-hidden="true">🤖</div>
   with:
     <img class="robot-avatar-large" src="assets/robot.png" alt="AI robot assistant" />
3. (Optional) do the same for the small avatar in js/chat.js's
   appendMessage() function.
