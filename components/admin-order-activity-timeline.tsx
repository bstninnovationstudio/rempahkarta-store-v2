"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, History } from "lucide-react";

export function AdminOrderActivityTimeline({
  events,
  devTools,
}: {
  events: Array<{ at: string; title: string; note: string }>;
  devTools?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="admin-section admin-section-activity">
      <button
        type="button"
        className="admin-collapsible-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="admin-collapsible-title">
          <History size={16} aria-hidden="true" />
          <h2>Aktivitas pesanan</h2>
          <span className="admin-activity-count">{events.length} riwayat</span>
        </div>
        <div className="admin-collapsible-toggle">
          {isOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </div>
      </button>

      {isOpen && (
        <div className="admin-collapsible-body">
          {devTools}
          <div className="timeline admin-order-timeline" role="list" aria-label="Riwayat aktivitas pesanan">
            {events.map((event, index) => (
              <div className="timeline-item" role="listitem" key={`${event.at}-${index}`}>
                <div className="timeline-time">{event.at}</div>
                <div className="timeline-marker" />
                <div className="timeline-content">
                  <strong>{event.title}</strong>
                  <p>{event.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
