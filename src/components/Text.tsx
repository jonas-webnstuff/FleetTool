import { Text as RNText, TextInput as RNTextInput, TextProps, TextInputProps } from "react-native";

// Drop-in replacements for RN's Text/TextInput that apply the app's default font.
// Replaces the old `Text.defaultProps` global mutation, which React has been
// deprecating for function components and could silently stop working on an upgrade.
const defaultFontStyle = { fontFamily: "Roboto_400Regular" } as const;

export function Text({ style, ...props }: TextProps) {
  return <RNText style={[defaultFontStyle, style]} {...props} />;
}

export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput style={[defaultFontStyle, style]} {...props} />;
}
