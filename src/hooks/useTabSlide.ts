import { useEffect } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

let _lastTabIndex = 0;
let _initialized = false;

const SLIDE_DISTANCE = 50;
const DURATION = 450;

export function useTabSlide(tabIndex: number) {
  const isFocused = useIsFocused();
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!isFocused) return;
    if (!_initialized) {
      _initialized = true;
      _lastTabIndex = tabIndex;
      return;
    }
    if (tabIndex !== _lastTabIndex) {
      const direction = tabIndex > _lastTabIndex ? 1 : -1;
      translateX.value = direction * SLIDE_DISTANCE;
      opacity.value = 0.3;
      translateX.value = withTiming(0, {
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
      });
      opacity.value = withTiming(1, { duration: DURATION - 80 });
      _lastTabIndex = tabIndex;
    }
  }, [isFocused, opacity, tabIndex, translateX]);

  return useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));
}
