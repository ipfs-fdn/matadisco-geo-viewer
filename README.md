Matadisco viewer
================

This is a viewer of metadata that was published on [ATProto]. The web viewer
gets Matadisco records from the past few minutes from [Bluesky's Jetstream]
and then keeps updating in real-time.

Currently the only publisher is the [sentinel-to-atproto] Cloudflare worker. So
you'll see a lot of satellite images being displayed. It's planned that in the
future there will also be other Matadisco records.

The viewer features a modern, responsive UI built with [Tailwind CSS] that works
seamlessly on desktop, tablet, and mobile devices.


Demo
----

See it in action at https://vmx.github.io/matadisco-viewer/.


Running locally
---------------

### Web viewer

Install dependencies:

    npm install

Start the development server with hot module replacement:

    npm run dev

You can now access the viewer at http://localhost:3000/

The dev server provides instant updates when you modify CSS or JavaScript files.


### CLI viewer

The CLI viewer just displays the metadata records as they arrive.

    npm install
    npm start


Building for production
-----------------------

To build an optimized production bundle:

    npm run build

The output will be in the `dist/` directory, ready to deploy to any static hosting service.

To preview the production build locally:

    npm run preview


Development
-----------

### Tech Stack

- **Vanilla JavaScript** (ES modules) - No framework dependencies
- **[Vite]** - Fast dev server with hot module replacement
- **[Tailwind CSS]** - Utility-first CSS framework
- **[ATProto Jetstream]** - Real-time event streaming from Bluesky

### Code Formatting

Format code with Biome:

    npm run fmt

### Project Structure

```
matadisco-viewer/
├── src/
│   ├── web.js         # Browser entry point
│   ├── node.js        # CLI entry point
│   ├── jetstream.js   # WebSocket connection logic
│   ├── config.js      # Configuration
│   └── input.css      # Tailwind CSS entry point
├── index.html         # HTML template with Tailwind classes
├── vite.config.js     # Vite configuration
└── tailwind.config.js # Tailwind configuration
```


License
-------

This project is licensed under either of

 - Apache License, Version 2.0, ([LICENSE-APACHE] or https://www.apache.org/licenses/LICENSE-2.0)
 - MIT license ([LICENSE-MIT] or https://opensource.org/licenses/MIT)

at your option.

[ATProto]: https://atproto.com/
[ATProto Jetstream]: https://docs.bsky.app/blog/jetstream
[Bluesky's Jetstream]: https://docs.bsky.app/blog/jetstream
[sentinel-to-atproto]: https://github.com/vmx/sentinel-to-atproto/
[Vite]: https://vitejs.dev/
[Tailwind CSS]: https://tailwindcss.com/
[LICENSE-APACHE]: ./LICENSE-APACHE
[LICENSE-MIT]: ./LICENSE-MIT
