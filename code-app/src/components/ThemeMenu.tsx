import {
  Button,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
} from '@fluentui/react-components';
import type { MenuProps } from '@fluentui/react-components';
import { DesktopRegular, WeatherMoonRegular, WeatherSunnyRegular } from '@fluentui/react-icons';
import type { ThemePreference } from '../hooks/useThemePreference';

interface ThemeMenuProps {
  preference: ThemePreference;
  isDark: boolean;
  onChange: (value: ThemePreference) => void;
  className?: string;
}

/** Botón del header para elegir el tema: Sistema (por defecto), Claro u Oscuro. */
export function ThemeMenu({ preference, isDark, onChange, className }: ThemeMenuProps) {
  const handleCheckedChange: MenuProps['onCheckedValueChange'] = (_e, data) => {
    const value = data.checkedItems[0] as ThemePreference | undefined;
    if (value) onChange(value);
  };

  return (
    <Menu checkedValues={{ theme: [preference] }} onCheckedValueChange={handleCheckedChange}>
      <MenuTrigger disableButtonEnhancement>
        <Button
          icon={isDark ? <WeatherMoonRegular /> : <WeatherSunnyRegular />}
          appearance="subtle"
          title="Tema"
          aria-label="Cambiar tema"
          className={className}
        />
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItemRadio name="theme" value="system" icon={<DesktopRegular />}>Sistema</MenuItemRadio>
          <MenuItemRadio name="theme" value="light" icon={<WeatherSunnyRegular />}>Claro</MenuItemRadio>
          <MenuItemRadio name="theme" value="dark" icon={<WeatherMoonRegular />}>Oscuro</MenuItemRadio>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
