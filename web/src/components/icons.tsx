// Line icons (24px grid, 1.7 stroke). Decorative by default.
import type { SVGProps } from 'react';

const P = (d: React.ReactNode) =>
  function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
        {d}
      </svg>
    );
  };

export const IconDashboard = P(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>);
export const IconCourses = P(<><path d="M4 19V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z" /><path d="M8 7h6M8 11h6" /></>);
export const IconKnowledge = P(<><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="8" r="2.5" /><circle cx="9" cy="18" r="2.5" /><path d="M8.2 7.2 15.6 8M7 8.4 8.5 15.6M10.8 16.6l5.6-6.6" /></>);
export const IconPlanner = P(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>);
export const IconTasks = P(<><path d="m4 7 2 2 4-4M4 17l2 2 4-4M13 8h7M13 18h7" /></>);
export const IconRevision = P(<><path d="M4 4v6h6" /><path d="M20 20v-6h-6" /><path d="M5.5 15a7 7 0 0 0 12.6 2M18.5 9A7 7 0 0 0 5.9 7" /></>);
export const IconSettings = P(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.8 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.1 14H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.9 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.8H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></>);
export const IconLogout = P(<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="m10 17-5-5 5-5M5 12h11" /></>);
export const IconSpark = P(<path d="M12 3l1.8 5.6L19.5 10l-5.7 1.6L12 17l-1.8-5.4L4.5 10l5.7-1.4Z" />);
export const IconUpload = P(<><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>);
export const IconDoc = P(<><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /></>);
export const IconPlus = P(<path d="M12 5v14M5 12h14" />);
export const IconArrow = P(<path d="M5 12h14M13 6l6 6-6 6" />);
export const IconBack = P(<path d="M19 12H5M11 6l-6 6 6 6" />);
export const IconCheck = P(<path d="m5 12 5 5 9-10" />);
export const IconTrash = P(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />);
export const IconSearch = P(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const IconClose = P(<path d="M6 6l12 12M18 6 6 18" />);
export const IconLink = P(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>);
export const IconClock = P(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
