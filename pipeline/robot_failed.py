"""robot_failed.py — emails Ana when a robot run on GitHub fails, so a broken robot never goes
unnoticed again (16–18 Oct: the email robot failed for two days, ODG #21 never reached the alarms).
Started by the last step of emails.yml and wrap-alerts.yml (soundcheck-data), only when a step failed.
One email per breakdown: when the run before this one also failed, it stays quiet. The email goes to
the production mailbox (GMAIL_ADDRESS, the same account the robot reads), or to ALERT_TO when set.

    GMAIL_ADDRESS=… GMAIL_APP_PASSWORD=… GITHUB_TOKEN=… python pipeline/robot_failed.py "<robot name>"
"""

import json
import os
import smtplib
import sys
import urllib.request
from email.message import EmailMessage


def previous_run_failed(repo, workflow, this_run):
    """Did the run before this one fail too? (then Ana already has an email)"""
    url = f"https://api.github.com/repos/{repo}/actions/workflows/{workflow}/runs?per_page=5&status=completed"
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {os.environ['GITHUB_TOKEN']}",
                                                   "Accept": "application/vnd.github+json"})
    try:
        runs = json.load(urllib.request.urlopen(request, timeout=20))["workflow_runs"]
    except Exception as error:  # can't tell: better one email too many than none
        print(f"could not read the earlier runs: {error}")
        return False
    earlier = [run for run in runs if str(run["id"]) != str(this_run)]
    return bool(earlier) and earlier[0]["conclusion"] == "failure"


def send(robot):
    repo, run = os.environ["GITHUB_REPOSITORY"], os.environ["GITHUB_RUN_ID"]
    workflow = os.environ.get("GITHUB_WORKFLOW_REF", "").split("@")[0].split("/")[-1]
    if workflow and previous_run_failed(repo, workflow, run):
        print("the run before failed too: Ana already knows, no new email")
        return
    sender = os.environ["GMAIL_ADDRESS"]
    message = EmailMessage()
    message["From"] = sender
    message["To"] = os.environ.get("ALERT_TO") or sender
    message["Subject"] = f"⚠ soundcheck: the {robot} robot stopped"
    message.set_content(
        f"The {robot} robot failed on GitHub. Until it is fixed, new ODGs don't reach the app "
        f"and the alarms keep the times they already know.\n\n"
        f"What went wrong: https://github.com/{repo}/actions/runs/{run}\n\n"
        f"Show this email to Claude. You get one email per breakdown, not one per run.")
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
        server.login(sender, os.environ["GMAIL_APP_PASSWORD"])
        server.send_message(message)
    print(f"failure email sent to {message['To']}")


if __name__ == "__main__":
    send(sys.argv[1] if len(sys.argv) > 1 else "email")
