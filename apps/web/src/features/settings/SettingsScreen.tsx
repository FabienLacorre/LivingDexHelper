import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { db } from '@/db/schema';
import { useSettings } from '@/store/settings';
import type { Theme } from '@livingdex/types';
import { useLiveQuery } from 'dexie-react-hooks';

export function SettingsScreen() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const meta = useLiveQuery(() => db.catalog_meta.get('meta'), []);

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Réglages</h1>
      </header>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mode de complétion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="solo">Mode solo</Label>
                <p className="text-xs text-muted-foreground">
                  Met en évidence les Pokémon nécessitant un échange (sans Lien Magique)
                </p>
              </div>
              <Switch
                id="solo"
                checked={settings.soloMode}
                onCheckedChange={(checked) => void update({ soloMode: checked })}
              />
            </div>

            <Toggle
              id="regional"
              label="Inclure les formes régionales"
              checked={settings.granularity.includeRegionalForms}
              onChange={(v) =>
                void update({ granularity: { ...settings.granularity, includeRegionalForms: v } })
              }
            />
            <Toggle
              id="gigamax"
              label="Inclure les Gigamax"
              checked={settings.granularity.includeGigamax}
              onChange={(v) =>
                void update({ granularity: { ...settings.granularity, includeGigamax: v } })
              }
            />
            <Toggle
              id="alt"
              label="Inclure les autres formes (Deoxys, Calyrex, Ogerpon...)"
              checked={settings.granularity.includeAltForms}
              onChange={(v) =>
                void update({ granularity: { ...settings.granularity, includeAltForms: v } })
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Apparence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="theme">Thème</Label>
              <Select
                value={settings.ui.theme}
                onValueChange={(v) => void update({ ui: { ...settings.ui, theme: v as Theme } })}
              >
                <SelectTrigger id="theme" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Système</SelectItem>
                  <SelectItem value="light">Clair</SelectItem>
                  <SelectItem value="dark">Sombre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Données</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Version du dataset : <code>{meta?.value.version ?? '—'}</code>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {meta?.value.pokemonCount ?? 0} Pokémon · {meta?.value.encountersCount ?? 0}{' '}
              encounters · sources {(meta?.value.scrapedFrom ?? []).join(', ')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
