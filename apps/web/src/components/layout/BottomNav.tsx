import { cn } from '@/lib/cn';
import { Gamepad2, Library, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const items = [
  { to: '/dex', label: 'Dex', icon: Library },
  { to: '/jeux', label: 'Jeux', icon: Gamepad2 },
  { to: '/reglages', label: 'Réglages', icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex items-center justify-around border-t bg-card md:hidden">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-xs',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
