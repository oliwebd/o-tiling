export function get_current_path(): string {
    let path = import.meta.url.split('://')[1].split('/').slice(0, -1).join('/');
    // If we are in a nested structure (e.g., dist/utils), go up to the extension root
    if (path.endsWith('/utils')) {
        path = path.split('/').slice(0, -1).join('/');
    }
    return path;
}
