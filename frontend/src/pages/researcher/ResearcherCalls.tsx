import EventsPage from '../events/Events';

/** Звонки и встречи исследователя — без сессий с клиентами */
export default function ResearcherCalls() {
  return <EventsPage mode="researcher" />;
}
