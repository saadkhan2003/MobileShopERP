"""Send deterministic X11 clicks/keys to the isolated desktop QA window."""
import os
import sys
import time
from Xlib import X, XK, display
from Xlib.ext import xtest

d = display.Display()
screen = d.screen()
offset_y = int(os.environ.get("NATIVE_WINDOW_Y", "84"))

def click(x, y):
    screen.root.warp_pointer(int(x), int(y) + offset_y)
    d.sync()
    xtest.fake_input(d, X.ButtonPress, 1)
    xtest.fake_input(d, X.ButtonRelease, 1)
    d.sync()
    time.sleep(0.15)

def key(name):
    code = d.keysym_to_keycode(XK.string_to_keysym(name))
    xtest.fake_input(d, X.KeyPress, code)
    xtest.fake_input(d, X.KeyRelease, code)
    d.sync()

def write(value):
    for ch in value:
        if ch == " ":
            key("space")
        elif ch == "/":
            key("slash")
        elif ch == ".":
            key("period")
        elif ch == "-":
            key("minus")
        elif ch.isupper():
            shift = d.keysym_to_keycode(XK.string_to_keysym("Shift_L"))
            xtest.fake_input(d, X.KeyPress, shift)
            key(ch.lower())
            xtest.fake_input(d, X.KeyRelease, shift)
        else:
            key(ch)
    d.sync()
    time.sleep(0.2)

if __name__ == "__main__":
    for action in sys.argv[1:]:
        if action.startswith("click:"):
            x, y = action[6:].split(",")
            click(x, y)
        elif action.startswith("write:"):
            write(action[6:])
        elif action.startswith("key:"):
            key(action[4:])
        elif action.startswith("chord:"):
            modifier, name = action[6:].split(",", 1)
            modifier_code = d.keysym_to_keycode(XK.string_to_keysym(modifier))
            xtest.fake_input(d, X.KeyPress, modifier_code)
            key(name)
            xtest.fake_input(d, X.KeyRelease, modifier_code)
            d.sync()
        elif action.startswith("wait:"):
            time.sleep(float(action[5:]))
        elif action.startswith("scroll:"):
            delta = int(action[7:])
            button = 5 if delta > 0 else 4
            for _ in range(abs(delta)):
                xtest.fake_input(d, X.ButtonPress, button)
                xtest.fake_input(d, X.ButtonRelease, button)
            d.sync()
            time.sleep(0.2)
