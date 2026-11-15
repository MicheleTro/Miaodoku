<script lang="ts">
  let { name }: { name: string } = $props();
</script>

<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if name === 'back'}<path d="M15 5l-7 7 7 7" />
  {:else if name === 'close'}<path d="M6 6l12 12M18 6L6 18" />
  {:else if name === 'undo'}<path d="M9 7L4 12l5 5" /><path d="M4 12h10a6 6 0 0 1 0 12h-2" transform="translate(0 -6)" />
  {:else if name === 'bulb'}<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1.2 1.6 1.2 2.5h5.6c0-.9.4-1.7 1.2-2.5A6 6 0 0 0 12 3z" />
  {:else if name === 'lume'}<path d="M9 4h6M10 4v2M14 4v2M8 8h8l1 9a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3z" /><path d="M12 11c1.5 1.5 1.5 3.5 0 5-1.5-1.5-1.5-3.5 0-5z" fill="currentColor" />
  {:else if name === 'reset'}<path d="M4 4v6h6" /><path d="M5.5 15a7 7 0 1 0 1.6-7.3L4 10" />
  {:else if name === 'swords'}<path d="M4 4l9 9M20 4l-9 9M6 15l3 3M15 18l3-3M4 20l3-3M20 20l-3-3" />
  {:else if name === 'user'}<circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
  {:else if name === 'flame'}<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-5 1-8z" fill="currentColor" />
  {:else if name === 'play'}<path d="M7 4l13 8-13 8z" fill="currentColor" />
  {:else if name === 'trophy'}<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6" />
  {:else if name === 'check'}<path d="M5 12l5 5 9-10" />
  {:else if name === 'plus'}<path d="M12 5v14M5 12h14" />
  {:else if name === 'logout'}<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
  {/if}
</svg>
