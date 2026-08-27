/**
 * Basic pressable button with a minimum 44×44 touch target.
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, radii, spacing, typography } from '@/src/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
};

/**
 * Simple themed button used by forms and Today actions.
 * Enforces minHeight / minWidth of 44 for accessibility touch targets.
 */
export function Button({
  title,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const onPrimary = variant === 'primary' || variant === 'danger';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          onPrimary ? styles.labelOnPrimary : styles.labelOnSurface,
          variant === 'ghost' ? styles.labelGhost : null,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    ...typography.button,
  },
  labelOnPrimary: {
    color: '#FFFFFF',
  },
  labelOnSurface: {
    color: colors.text,
  },
  labelGhost: {
    color: colors.primary,
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
});

export default Button;
