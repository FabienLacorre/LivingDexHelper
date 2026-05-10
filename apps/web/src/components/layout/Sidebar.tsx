import { NavLink } from 'react-router-dom';
import { Library, Gamepad2, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';

const items = [
  { to: '/dex', label: 'Dex', icon: Library },
  { to: '/jeux', label: 'Jeux', icon: Gamepad2 },
  { to: '/reglages', label: 'Réglages', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-card">
      <div className="px-4 py-5">
        <h1 className="text-lg font-bold">Living Dex</h1>
        <p className="text-xs text-muted-foreground">vers Pokémon HOME</p>
      </div>
      <nav className="flex-1 space-y-1 px-2 py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground/80 hover:bg-accent hover:text-accent-foreground',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
