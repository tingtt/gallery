# Gallery

Photo gallery.

## Usage

### Running with Docker Compose

```yaml
services:
  gallery:
    image: tingtt/gallery:v2.0.0
    ports:
      - "3000:3000"
    volumes:
      - img_data:/var/lib/tingtt_gallery
    restart: always

volumes:
  img_data:
```

## Data directory structure

```
/var/lib/tingtt_gallery (default mount path)
└── Pictures
    ├── 01234de9-c2cd-11ed-b48a-0242ac1c0002.jpg
    ├── 02697f11-696f-11ef-a323-ee101a9bd2b5.png
    ├── 02ab0705-a733-11ed-b6a3-0242ac1c0002.jpg
    ├── 03566db6-d28e-11ee-ab45-1e4757330f41.jpg
    ├── 0395f8a4-f1f3-11ee-8948-52eddf93fa72.jpg
    ├── 049e622b-42de-11ef-a323-ee101a9bd2b5.jpg
```
