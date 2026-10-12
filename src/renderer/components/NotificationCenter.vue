<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import IconClose from '@/renderer/components/icons/IconClose.vue';
import { useNotifications } from '@/renderer/composables/ui/useNotifications';

const { t } = useI18n();
const { notifications, dismiss, pause, resume } = useNotifications();
</script>

<template>
    <section
        class="notification-center"
        :aria-label="t('notifications.region')">
        <TransitionGroup
            name="notification"
            tag="ul"
            class="notification-list stack">
            <!-- eslint-disable-next-line a11y/no-static-element-interactions -- hover and focus only hold the dismiss timer; nothing is activated -->
            <li
                v-for="notification in notifications"
                :key="notification.id"
                class="notification floating row"
                role="alert"
                @mouseenter="pause"
                @mouseleave="resume"
                @focusin="pause"
                @focusout="resume">
                <p class="notification-message fill">{{ notification.message }}</p>
                <button
                    class="icon-btn"
                    :title="t('notifications.dismiss')"
                    :aria-label="t('notifications.dismiss')"
                    @click="dismiss(notification.id)">
                    <IconClose
                        width="14"
                        height="14" />
                </button>
            </li>
        </TransitionGroup>
    </section>
</template>

<style scoped lang="scss">
.notification-center {
    position: fixed;
    right: $space-4;
    bottom: $space-4;
    z-index: $z-max;
    pointer-events: none;
}

.notification-list {
    gap: $space-2;
    margin: 0;
    padding: 0;
    list-style: none;
}

.notification {
    align-items: flex-start;
    gap: $space-2;
    width: $size-28;
    max-width: calc(100vw - $size-12);
    padding: $space-2;
    color: $text1;
    font-size: $font-size-sm;
    pointer-events: auto;
}

.notification-message {
    margin: 0;
    padding-top: $space-1;
    line-height: $line-height-tight;
    overflow-wrap: anywhere;
}

.notification-enter-active,
.notification-leave-active {
    transition:
        opacity $transition-base,
        transform $transition-base;
}

.notification-enter-from,
.notification-leave-to {
    opacity: 0;
    transform: translateY($space-2);
}
</style>
