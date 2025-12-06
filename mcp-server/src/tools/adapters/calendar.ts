export interface CalendarPayload {
    action: 'create_event' | 'list_events' | 'delete_event';
    title?: string;
    date?: string;
    time?: string;
    duration?: number;
    description?: string;
    eventId?: string;
}

// In-memory event store (in production, integrate with Google Calendar, Outlook, etc.)
const events: Map<string, {
    id: string;
    title: string;
    date: string;
    time: string;
    duration: number;
    description?: string;
}> = new Map();

let eventCounter = 1;

export async function executeCalendar(payload: CalendarPayload): Promise<string> {
    const { action, title, date, time, duration, description, eventId } = payload;

    switch (action) {
        case 'create_event': {
            if (!title || !date) {
                throw new Error('Title and date are required for creating an event');
            }

            const id = `event-${eventCounter++}`;
            const event = {
                id,
                title,
                date,
                time: time || '09:00',
                duration: duration || 60,
                description,
            };

            events.set(id, event);

            return `📅 Event created:\nID: ${id}\nTitle: ${title}\nDate: ${date} at ${event.time}\nDuration: ${event.duration} minutes${description ? `\nDescription: ${description}` : ''}`;
        }

        case 'list_events': {
            if (events.size === 0) {
                return 'No events scheduled';
            }

            const eventList = Array.from(events.values())
                .map(e => `• ${e.title} - ${e.date} at ${e.time} (${e.duration}min)`)
                .join('\n');

            return `📅 Scheduled events:\n${eventList}`;
        }

        case 'delete_event': {
            if (!eventId) {
                throw new Error('Event ID is required for deletion');
            }

            if (!events.has(eventId)) {
                throw new Error(`Event not found: ${eventId}`);
            }

            const event = events.get(eventId)!;
            events.delete(eventId);

            return `Event deleted: ${event.title} (${event.date})`;
        }

        default:
            throw new Error(`Unknown calendar action: ${action}`);
    }
}
