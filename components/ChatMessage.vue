<template>
    <div class="d-flex mb-4" :class="isUser ? 'justify-end' : 'justify-start'">
        <div
            class="chat-bubble pa-3 rounded-lg"
            :class="[isUser ? 'user-bubble' : 'agent-bubble', message.error ? 'error-bubble' : '']"
            style="max-width: 80%; white-space: pre-wrap; word-break: break-word"
        >
            <div v-if="!isUser" class="d-flex align-center mb-1">
                <v-icon size="16" class="mr-1" :color="message.error ? 'error' : 'primary'">
                    {{ message.error ? 'mdi-alert-circle' : 'mdi-robot' }}
                </v-icon>
                <span class="text-caption text-medium-emphasis">Agent</span>
            </div>
            <div class="text-body-2">{{ message.text }}</div>
            <div class="text-caption text-medium-emphasis mt-1" style="opacity: 0.6">
                {{ formatTime(message.timestamp) }}
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import type { ChatMessage } from '~/composables/useAgentChat';

    const props = defineProps<{ message: ChatMessage }>();
    const isUser = computed(() => props.message.role === 'user');

    function formatTime(ts: number): string {
        return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
</script>

<style scoped>
    .user-bubble {
        background: rgba(63, 234, 0, 0.12);
        border: 1px solid rgba(63, 234, 0, 0.25);
    }
    .agent-bubble {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .error-bubble {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.3);
    }
</style>
