'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Shows a thin animated bar at the top of the viewport during route changes.
 * Pure visual reassurance — server-rendering still takes whatever time it takes,
 * but the user sees that the app is alive.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 350);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;
  return <div className="route-progress" />;
}
