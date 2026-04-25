"""
ContractPulse Scheduler — Flask REST API
=========================================
Wraps the TaskScheduler + MeetingRoomScheduler into a clean HTTP API.

Endpoints:
  POST /api/process_breach      — process a single breach
  POST /api/process_batch       — process multiple breaches
  GET  /api/tasks               — list all tasks (optional ?severity=CRITICAL)
  GET  /api/meetings            — list all booked meetings
  GET  /api/departments         — department workload summary
  POST /api/reset               — reset the scheduler state
  GET  /api/health              — health check
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional

from flask import Blueprint, jsonify, request

scheduler_bp = Blueprint("scheduler", __name__)


# ─────────────────────────────────────────────────────────────
# SCHEDULER CORE
# ─────────────────────────────────────────────────────────────

class Department(Enum):
    FINANCE     = "Finance"
    LEGAL       = "Legal"
    TECH        = "Tech"
    OPERATIONS  = "Operations"
    COMPLIANCE  = "Compliance"
    EXECUTIVE   = "Executive"


class Severity(Enum):
    LOW      = 1
    MEDIUM   = 2
    HIGH     = 3
    CRITICAL = 4


class ObligationType(Enum):
    REVENUE             = "revenue"
    DEBT_TO_EQUITY      = "debt_to_equity_ratio"
    CURRENT_RATIO       = "current_ratio"
    REPORT_SUBMISSION   = "report_submission"
    WORKFORCE_SIZE      = "workforce_size"
    CAPEX_LIMIT         = "capex_limit"
    LIQUIDITY_RATIO     = "liquidity_ratio"
    INSURANCE_COVERAGE  = "insurance_coverage"
    UNKNOWN             = "unknown"


OBLIGATION_OWNERS: dict[ObligationType, list[Department]] = {
    ObligationType.REVENUE:            [Department.FINANCE, Department.EXECUTIVE],
    ObligationType.DEBT_TO_EQUITY:     [Department.FINANCE, Department.LEGAL],
    ObligationType.CURRENT_RATIO:      [Department.FINANCE],
    ObligationType.REPORT_SUBMISSION:  [Department.COMPLIANCE, Department.LEGAL],
    ObligationType.WORKFORCE_SIZE:     [Department.OPERATIONS, Department.LEGAL],
    ObligationType.CAPEX_LIMIT:        [Department.FINANCE, Department.OPERATIONS],
    ObligationType.LIQUIDITY_RATIO:    [Department.FINANCE, Department.EXECUTIVE],
    ObligationType.INSURANCE_COVERAGE: [Department.COMPLIANCE, Department.LEGAL],
    ObligationType.UNKNOWN:            [Department.LEGAL],
}

SEVERITY_ESCALATION: dict[Severity, list[Department]] = {
    Severity.LOW:      [],
    Severity.MEDIUM:   [],
    Severity.HIGH:     [Department.LEGAL],
    Severity.CRITICAL: [Department.LEGAL, Department.EXECUTIVE],
}

SEVERITY_DUE_HOURS: dict[Severity, int] = {
    Severity.LOW:      72,
    Severity.MEDIUM:   48,
    Severity.HIGH:     24,
    Severity.CRITICAL: 4,
}


@dataclass
class Room:
    room_id: str
    name: str
    capacity: int
    has_av: bool = True


@dataclass(order=True)
class MeetingSlot:
    start: datetime
    end: datetime
    meeting_id: str = field(compare=False)
    room_id: str    = field(compare=False)
    title: str      = field(compare=False)
    attendees: int  = field(compare=False, default=4)

    def overlaps(self, start: datetime, end: datetime) -> bool:
        return self.start < end and self.end > start

    def to_dict(self) -> dict:
        return {
            "meeting_id":  self.meeting_id,
            "title":       self.title,
            "room":        self.room_id,
            "start":       self.start.isoformat(),
            "end":         self.end.isoformat(),
            "attendees":   self.attendees,
        }


@dataclass
class Meeting:
    title: str
    start: datetime
    end: datetime
    attendees: int
    needs_av: bool = False
    meeting_id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])


class MeetingRoomScheduler:
    def __init__(self, rooms: list[Room]) -> None:
        self.rooms = sorted(rooms, key=lambda r: r.capacity)
        self._bookings: dict[str, list[MeetingSlot]] = {r.room_id: [] for r in rooms}

    def reset(self) -> None:
        self._bookings = {r.room_id: [] for r in self.rooms}

    def schedule(self, meeting: Meeting) -> Optional[MeetingSlot]:
        if meeting.end <= meeting.start:
            return None
        for room in self._eligible_rooms(meeting):
            if self._is_free(room, meeting.start, meeting.end):
                slot = MeetingSlot(
                    start=meeting.start, end=meeting.end,
                    meeting_id=meeting.meeting_id, room_id=room.room_id,
                    title=meeting.title, attendees=meeting.attendees,
                )
                self._bookings[room.room_id].append(slot)
                self._bookings[room.room_id].sort()
                return slot
        return None

    def free_slots(self, room_id: str, window_start: datetime, window_end: datetime, min_duration_minutes: int = 30) -> list[tuple]:
        slots = self._bookings.get(room_id, [])
        free, cursor = [], window_start
        for slot in slots:
            if slot.start > cursor:
                if (slot.start - cursor).total_seconds() / 60 >= min_duration_minutes:
                    free.append((cursor, slot.start))
            cursor = max(cursor, slot.end)
        if cursor < window_end and (window_end - cursor).total_seconds() / 60 >= min_duration_minutes:
            free.append((cursor, window_end))
        return free

    def all_bookings(self) -> list[MeetingSlot]:
        result = []
        for slots in self._bookings.values():
            result.extend(slots)
        return sorted(result)

    def _eligible_rooms(self, meeting: Meeting) -> list[Room]:
        return [r for r in self.rooms if r.capacity >= meeting.attendees and (not meeting.needs_av or r.has_av)]

    def _is_free(self, room: Room, start: datetime, end: datetime) -> bool:
        return not any(s.overlaps(start, end) for s in self._bookings[room.room_id])


@dataclass
class BreachedObligation:
    contract_id: str
    obligation_type: ObligationType
    metric_name: str
    threshold_value: float
    current_value: float
    predicted_value: Optional[float]
    deadline: str
    consequence: str
    conflict_with: Optional[str] = None

    @property
    def breach_gap(self) -> float:
        return self.current_value - self.threshold_value

    def auto_severity(self) -> Severity:
        critical_kw = {"termination", "default", "liquidation", "penalty"}
        high_kw     = {"notice", "cure period", "acceleration"}
        cl = self.consequence.lower()
        if any(k in cl for k in critical_kw) or self.conflict_with:
            return Severity.CRITICAL
        if any(k in cl for k in high_kw):
            return Severity.HIGH
        gap_pct = abs(self.breach_gap) / (abs(self.threshold_value) + 1e-9)
        if gap_pct > 0.30:
            return Severity.HIGH
        if gap_pct > 0.10:
            return Severity.MEDIUM
        return Severity.LOW


@dataclass
class Task:
    task_id: str
    title: str
    description: str
    assigned_to: list[Department]
    severity: Severity
    due_by: datetime
    contract_id: str
    obligation_type: ObligationType
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict:
        return {
            "task_id":         self.task_id,
            "title":           self.title,
            "description":     self.description,
            "assigned_to":     [d.value for d in self.assigned_to],
            "severity":        self.severity.name,
            "due_by":          self.due_by.isoformat(),
            "contract_id":     self.contract_id,
            "obligation_type": self.obligation_type.value,
            "created_at":      self.created_at.isoformat(),
        }


class TaskScheduler:
    def __init__(self, room_scheduler: Optional[MeetingRoomScheduler] = None) -> None:
        self._tasks: list[Task] = []
        self._room_scheduler = room_scheduler
        self._task_counter = 0
        self._auto_meetings: list[MeetingSlot] = []

    def reset(self) -> None:
        self._tasks = []
        self._task_counter = 0
        self._auto_meetings = []
        if self._room_scheduler:
            self._room_scheduler.reset()

    def process_breach(self, breach: BreachedObligation) -> tuple[Task, Optional[MeetingSlot]]:
        severity    = breach.auto_severity()
        departments = self._resolve_departments(breach.obligation_type, severity)
        due_by      = datetime.now() + timedelta(hours=SEVERITY_DUE_HOURS[severity])
        self._task_counter += 1
        task = Task(
            task_id=f"TASK-{self._task_counter:04d}",
            title=f"[{severity.name}] Breach: {breach.metric_name} in {breach.contract_id}",
            description=self._build_description(breach, severity),
            assigned_to=departments,
            severity=severity,
            due_by=due_by,
            contract_id=breach.contract_id,
            obligation_type=breach.obligation_type,
        )
        self._tasks.append(task)

        meeting_slot = None
        if breach.conflict_with and self._room_scheduler:
            meeting_slot = self._book_conflict_meeting(task, breach)

        self._alert_team_via_email(task)

        return task, meeting_slot

    def _alert_team_via_email(self, task: Task) -> None:
        if task.severity not in [Severity.CRITICAL, Severity.HIGH]:
            return
        email_body = f"""
        [URGENT] Covenant Breach Alert: {task.title}

        A {task.severity.name} severity breach has been processed by the ContractPulse Response Engine.

        Task ID: {task.task_id}
        Assigned To: {[d.value for d in task.assigned_to]}
        Due By: {task.due_by.strftime('%Y-%m-%d %H:%M:%S')}

        Details:
        {task.description}

        Please take immediate action.
        """
        
        # Try to send a real email if credentials are set
        sender_email = os.getenv("SMTP_EMAIL")
        sender_password = os.getenv("SMTP_PASSWORD")
        receiver_email = os.getenv("ALERT_RECEIVER_EMAIL", sender_email) # Send to self if no specific receiver
        
        if sender_email and sender_password and receiver_email:
            try:
                msg = EmailMessage()
                msg.set_content(email_body)
                msg['Subject'] = f"[URGENT] Covenant Breach Alert: {task.title}"
                msg['From'] = sender_email
                msg['To'] = receiver_email
                
                # Assuming Gmail SMTP for this example
                with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
                    server.login(sender_email, sender_password)
                    server.send_message(msg)
                    
                print(f"📧 REAL EMAIL SUCCESSFULLY SENT TO {receiver_email}")
                return
            except Exception as e:
                print(f"Failed to send real email: {e}. Falling back to terminal log.")
        
        # Fallback to terminal if no credentials or sending fails
        print("\n" + "="*60)
        print("📧 AUTOMATED EMAIL ALERT DISPATCHED (Terminal Mock)")
        print("="*60)
        print(email_body)
        print("="*60 + "\n")

    def process_batch(self, breaches: list[BreachedObligation]) -> tuple[list[Task], list[MeetingSlot]]:
        results = [self.process_breach(b) for b in breaches]
        tasks    = [r[0] for r in results]
        meetings = [r[1] for r in results if r[1]]
        return sorted(tasks, key=lambda t: t.severity.value, reverse=True), meetings

    def all_tasks(self) -> list[Task]:
        return sorted(self._tasks, key=lambda t: t.severity.value, reverse=True)

    def department_summary(self) -> dict:
        summary = {}
        for task in self._tasks:
            for dept in task.assigned_to:
                key = dept.value
                if key not in summary:
                    summary[key] = {s.name: 0 for s in Severity}
                summary[key][task.severity.name] += 1
        return summary

    def _resolve_departments(self, ob_type: ObligationType, severity: Severity) -> list[Department]:
        primary   = OBLIGATION_OWNERS.get(ob_type, [Department.LEGAL])
        escalated = SEVERITY_ESCALATION.get(severity, [])
        return list(dict.fromkeys(primary + escalated))

    def _build_description(self, breach: BreachedObligation, severity: Severity) -> str:
        lines = [
            f"Contract  : {breach.contract_id}",
            f"Metric    : {breach.metric_name}",
            f"Threshold : {breach.threshold_value}",
            f"Current   : {breach.current_value}  (gap={breach.breach_gap:+.2f})",
        ]
        if breach.predicted_value is not None:
            lines.append(f"Predicted : {breach.predicted_value} (next period)")
        lines += [f"Deadline  : {breach.deadline}", f"Consequence: {breach.consequence}"]
        if breach.conflict_with:
            lines.append(f"⚠ Conflicts with: {breach.conflict_with}")
        return "\n  ".join(lines)

    def _book_conflict_meeting(self, task: Task, breach: BreachedObligation) -> Optional[MeetingSlot]:
        now        = datetime.now().replace(second=0, microsecond=0)
        window_end = now + timedelta(hours=8)
        for room in self._room_scheduler.rooms:
            free = self._room_scheduler.free_slots(room.room_id, now, window_end, min_duration_minutes=60)
            if free:
                start, _ = free[0]
                meeting  = Meeting(
                    title=f"Conflict Review: {breach.contract_id} vs {breach.conflict_with}",
                    start=start, end=start + timedelta(minutes=60),
                    attendees=max(3, len(task.assigned_to) * 2),
                    needs_av=True,
                )
                slot = self._room_scheduler.schedule(meeting)
                if slot:
                    self._auto_meetings.append(slot)
                    return slot
        return None


# ─────────────────────────────────────────────────────────────
# GLOBAL SCHEDULER INSTANCE
# ─────────────────────────────────────────────────────────────

def _build_scheduler() -> TaskScheduler:
    rooms = [
        Room("R1", "Boardroom",     capacity=20, has_av=True),
        Room("R2", "Conference A",  capacity=10, has_av=True),
        Room("R3", "Conference B",  capacity=8,  has_av=False),
        Room("R4", "Huddle Room 1", capacity=4,  has_av=False),
        Room("R5", "Huddle Room 2", capacity=4,  has_av=True),
    ]
    return TaskScheduler(room_scheduler=MeetingRoomScheduler(rooms))


# Use a mutable container so blueprint routes can rebind it reliably
_state = {"scheduler": _build_scheduler()}


def get_scheduler() -> TaskScheduler:
    return _state["scheduler"]


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def _parse_obligation_type(raw: str) -> ObligationType:
    for ot in ObligationType:
        if ot.value == raw:
            return ot
    return ObligationType.UNKNOWN


def _breach_from_dict(d: dict) -> BreachedObligation:
    return BreachedObligation(
        contract_id=d["contract_id"],
        obligation_type=_parse_obligation_type(d.get("obligation_type", "unknown")),
        metric_name=d.get("metric_name", d.get("obligation_type", "unknown")),
        threshold_value=float(d["threshold_value"]),
        current_value=float(d["current_value"]),
        predicted_value=float(d["predicted_value"]) if d.get("predicted_value") is not None else None,
        deadline=d.get("deadline", "unknown"),
        consequence=d.get("consequence", "notice"),
        # BUG FIX: treat empty string as None so conflict meetings are not
        # accidentally triggered when the frontend sends conflict_with: ""
        conflict_with=d.get("conflict_with") or None,
    )


# ─────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────

@scheduler_bp.get("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})


@scheduler_bp.post("/api/process_breach")
def process_breach():
    """
    Body (JSON):
      {
        "contract_id": "CTR-001",
        "obligation_type": "revenue",
        "metric_name": "revenue",
        "threshold_value": 5000000,
        "current_value": 3800000,
        "predicted_value": 3500000,   // optional
        "deadline": "annually",
        "consequence": "termination",
        "conflict_with": null          // optional contract_id
      }
    """
    body = request.get_json(force=True)
    try:
        breach = _breach_from_dict(body)
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid payload: {e}"}), 400

    task, meeting_slot = get_scheduler().process_breach(breach)

    return jsonify({
        "task":    task.to_dict(),
        "meeting": meeting_slot.to_dict() if meeting_slot else None,
    }), 201


@scheduler_bp.post("/api/process_batch")
def process_batch():
    """
    Body: { "breaches": [ <breach>, ... ] }
    Returns tasks sorted by severity desc + any auto-booked meetings.
    """
    body = request.get_json(force=True)
    raw_breaches = body.get("breaches", [])
    if not raw_breaches:
        return jsonify({"error": "breaches list is empty"}), 400

    try:
        breaches = [_breach_from_dict(b) for b in raw_breaches]
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"Invalid breach in batch: {e}"}), 400

    tasks, meetings = get_scheduler().process_batch(breaches)

    return jsonify({
        "tasks":    [t.to_dict() for t in tasks],
        "meetings": [m.to_dict() for m in meetings],
        "count":    len(tasks),
    }), 201


@scheduler_bp.get("/api/tasks")
def get_tasks():
    """
    Query params:
      ?severity=CRITICAL   (optional filter)
      ?department=Finance  (optional filter)
    """
    sev_filter  = request.args.get("severity", "").upper()
    dept_filter = request.args.get("department", "")
    tasks = get_scheduler().all_tasks()

    if sev_filter and sev_filter in Severity.__members__:
        target = Severity[sev_filter]
        tasks = [t for t in tasks if t.severity == target]

    if dept_filter:
        dept_vals = [d.value for d in Department]
        if dept_filter in dept_vals:
            target_dept = Department(dept_filter)
            tasks = [t for t in tasks if target_dept in t.assigned_to]

    return jsonify({"tasks": [t.to_dict() for t in tasks], "count": len(tasks)})


# BUG FIX: There were TWO @scheduler_bp.get("/api/meetings") routes in the
# original file. Flask registers only the FIRST one it sees, which called a
# non-existent method `_task_scheduler_meetings()` and crashed on every
# request. The second (correct) route was silently ignored.
# Fixed: one route that correctly reads _auto_meetings from the scheduler.
@scheduler_bp.get("/api/meetings")
def get_meetings():
    """Return all auto-booked conflict-resolution meeting slots."""
    auto = get_scheduler()._auto_meetings or []
    return jsonify({"meetings": [m.to_dict() for m in auto], "count": len(auto)})


@scheduler_bp.get("/api/departments")
def get_departments():
    return jsonify({"summary": get_scheduler().department_summary()})


@scheduler_bp.post("/api/reset")
def reset():
    # BUG FIX: rebinding a module-level `scheduler` variable inside a
    # blueprint function is unreliable — the local name rebinds but callers
    # that already imported the old object keep the stale reference.
    # Fixed: mutate the shared _state dict so all routes see the new instance.
    _state["scheduler"] = _build_scheduler()
    return jsonify({"status": "reset", "timestamp": datetime.now().isoformat()})

# Add this at the very bottom of scheduler_api.py
scheduler = _state["scheduler"]