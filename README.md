# Sound Output Chooser

A GNOME Shell extension to quickly select audio output devices from the system tray.

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/peterrhone/sound-output-chooser.git ~/.local/share/gnome-shell/extensions/sound-output-chooser@peterrhone.github.io

2. make the script executable
    ```bash
    chmod +x get_audio_devices.sh

3. enable the extension
    ```bash
    gnome-extensions enable sound-output-chooser@peterrhone.github.io


## Dependencies
1. pipewire (only works on systems with pipewire, not pulseaudio)
2. wireplumbler
3. jq
