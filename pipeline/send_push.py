"""send_push.py — sends one wrap alert ("Did today finish on time?") to every phone that turned
"🔔 Wrap alerts" on in the app (projects/<film>/push/*.json, written by parts/wrap-alerts.js).
Started by the "Wrap alerts" workflow (wrap-alerts.yml in soundcheck-data), which the Gmail trigger
(pipeline/gmail-trigger.gs) runs when a question is due. A phone that no longer accepts
notifications (app deleted, permission off) has its file removed.

    VAPID_PRIVATE_KEY=… python pipeline/send_push.py <film folder> "<title>" "<text>"
"""

import json
import os
import sys
from pathlib import Path

from pywebpush import WebPushException, webpush

CONTACT = "mailto:chiossi.sound@gmail.com"  # who sends them (the push services ask for a contact)


def send(film, title, body, url="./", tag="wrap"):
    sent, gone = 0, []
    for path in sorted((Path(film) / "push").glob("*.json")):
        phone = json.loads(path.read_text(encoding="utf-8"))
        try:
            webpush({"endpoint": phone["endpoint"], "keys": phone["keys"]},
                    data=json.dumps({"title": title, "body": body, "tag": tag, "url": url}),
                    vapid_private_key=os.environ["VAPID_PRIVATE_KEY"], vapid_claims={"sub": CONTACT}, ttl=3600)
            sent += 1
        except WebPushException as error:
            if error.response is not None and error.response.status_code in (404, 410):
                path.unlink()
                gone.append(path.stem)
            else:
                print(f"{path.stem}: {error}")
    print(f"sent to {sent} phone(s)" + (f"; removed (no longer accepting): {', '.join(gone)}" if gone else ""))
    return sent


if __name__ == "__main__":
    args = sys.argv[1:] + [""] * 5
    send(args[0], args[1], args[2], args[3] or "./", args[4] or "wrap")
