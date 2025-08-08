/*
 * Sound Output Chooser
 * Copyright (C) 2025 Peter Rhone <prhone@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

// *Starting up the sound switcher*
log('[Sound Output Chooser] Loading extension');

export default class SoundOutputExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null; // Indicator’s chilling for now.
    }

    // * Activation*
    enable() {
        try {
            log('[Sound Output Chooser] Enabling extension for GNOME 49. Let’s rock the desktop!');

            // Spawning a panel button 
            this._indicator = new PanelMenu.Button(0.0, 'sound-output-chooser', false);

            // Make the button clickable 
            const button = new St.Button({
                style_class: 'panel-status-button',
                can_focus: true,
                track_hover: true,
                reactive: true
            });

            // Slapping an icon on this bad boy 
            const icon = new St.Icon({
                icon_name: 'audio-card-symbolic',
                style_class: 'system-status-icon',
            });
            button.add_child(icon);

            // Yeeting the button onto the indicator 
            this._indicator.add_child(button);

            // Place in the GNOME panel. 
            Main.panel.addToStatusArea('sound-output-chooser', this._indicator);
            log('[Sound Output Chooser] Indicator placed into the panel');

            // Create a menu 
            this._buildMenu();
            this._updateAudioDevices();

            // Click the icon, refresh the devices. 
            this._indicator.connect('button-press-event', () => {
                this._updateAudioDevices();
            });

        } catch (e) {
            logError(e, '[Sound Output Chooser] Crash-landed while enabling. Send help!');
        }
    }

    // *Assembling the menu*
    _buildMenu() {
        this._indicator.menu.removeAll(); // Clear the slate. 

        // Adding a title 
        this._indicator.menu.addMenuItem(new PopupMenu.PopupMenuItem(_('Audio Output Devices')));

        // add a separator 
        this._indicator.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }

    // *Refreshing audio devices*
    _updateAudioDevices() {
        try {
            log('[Sound Output Chooser] Looking for audio devices');

            // Nuking old menu items after the first two (title and separator). 
            const children = this._indicator.menu.box.get_children();
            for (let i = 2; i < children.length; i++) {
                children[i].destroy(); 
            }

            // Get the extension’s directory from import.meta.url 
            const scriptUrl = import.meta.url;
            const [scriptPath] = GLib.filename_from_uri(scriptUrl);
            const scriptDir = GLib.path_get_dirname(scriptPath);
            const getAudioDevicesPath = GLib.build_filenamev([scriptDir, 'get_audio_devices.sh']);

            // Check if the script exists 
            const scriptFile = Gio.File.new_for_path(getAudioDevicesPath);
            if (!scriptFile.query_exists(null)) {
                log(`[Sound Output Chooser] Shell script not found at: ${getAudioDevicesPath}`);
                const menuItem = new PopupMenu.PopupMenuItem(_('Error: get_audio_devices.sh missing'));
                menuItem.reactive = false;
                this._indicator.menu.addMenuItem(menuItem);
                return;
            }

            // Run the shell script to fetch audio sinks 
            const [success, stdout, stderr, exitStatus] = GLib.spawn_command_line_sync(getAudioDevicesPath);

            if (success && stdout && exitStatus === 0) {
                const output = stdout.toString().trim();
                log(`[Sound Output Chooser] Shell script dropped the goods: ${output}`);

                // Split output into lines, dodging any whitespace 
                const devices = output ? output.split('\n').filter(line => line.trim() !== '') : [];
                let foundDevices = false;

                if (devices.length === 0) {
                    log('[Sound Output Chooser] Shell script returned empty output. PipeWire playing hide and seek?');
                    const menuItem = new PopupMenu.PopupMenuItem(_('No audio devices found. Script output empty'));
                    menuItem.reactive = false;
                    this._indicator.menu.addMenuItem(menuItem);
                    return;
                }

                for (let line of devices) {
                    let device;
                    try {
                        device = JSON.parse(line.trim());
                    } catch (e) {
                        log(`[Sound Output Chooser] JSON parse failed for line: ${line} - ${e.message}`);
                        continue;
                    }
                    const deviceName = device.desc?.trim() || `Device ${device.id}`; // Use desc for pretty names.
                    const deviceId = device.id;

                    // Only add devices with IDs. 
                    if (deviceId) {
                        const menuItem = new PopupMenu.PopupMenuItem(deviceName);
                        menuItem.connect('activate', () => {
                            try {
                                // set output device with `wpctl set-default` 
                                const [success] = GLib.spawn_async(
                                    null,
                                    ['wpctl', 'set-default', deviceId.toString()],
                                    null,
                                    GLib.SpawnFlags.SEARCH_PATH,
                                    null
                                );

                                if (success) {
                                    log(`[Sound Output Chooser] Switched to ${deviceName} (ID: ${deviceId}).`);
                                } else {
                                    throw new Error('Command flopped harder than a bad reboot');
                                }
                            } catch (e) {
                                logError(e, `[Sound Output Chooser] Failed to switch to ${deviceName} (ID: ${deviceId}). Epic fail!`);
                            }
                        });

                        this._indicator.menu.addMenuItem(menuItem);
                        foundDevices = true;
                        log(`[Sound Output Chooser] Added ${deviceName} (ID: ${deviceId})`);
                    }
                }

                if (!foundDevices) {
                    const menuItem = new PopupMenu.PopupMenuItem(_('No audio devices found.'));
                    menuItem.reactive = false;
                    this._indicator.menu.addMenuItem(menuItem);
                    log('[Sound Output Chooser] No devices found.');
                }
            } else {
                const errorMsg = stderr ? stderr.toString().trim() : 'Script ghosted us';
                log(`[Sound Output Chooser] Shell script failed: ${errorMsg}`);
                const menuItem = new PopupMenu.PopupMenuItem(_('Error fetching audio devices'));
                menuItem.reactive = false;
                this._indicator.menu.addMenuItem(menuItem);
            }
        } catch (e) {
            logError(e, '[Sound Output Chooser] Audio update crashed harder than a Windows 95 box');
            const menuItem = new PopupMenu.PopupMenuItem(_('Extension broke.'));
            menuItem.reactive = false;
            this._indicator.menu.addMenuItem(menuItem);
        }
    }

    // *Shutting down*
    disable() {
        try {
            log('[Sound Output Chooser] Disabling extension. Time to pack up and go home');

            if (this._indicator) {
                this._indicator.destroy(); // Obliterating the indicator 
                this._indicator = null;
            }
        } catch (e) {
            logError(e, '[Sound Output Chooser] Disable failed. We’re stuck in the matrix!');
        }
    }
}
