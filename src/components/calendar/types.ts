export interface CalendarAttendee {
  email: string;
  responseStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO
  end: string; // ISO
  meetLink?: string;
  attendees?: CalendarAttendee[];
  recurrence?: string; // e.g. "RRULE:FREQ=WEEKLY;BYDAY=TU"
  recurringEventId?: string;
}
