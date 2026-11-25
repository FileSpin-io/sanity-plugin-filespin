/**
 * A Studio for trying the plugin from source: `npm run dev` in the repo root.
 * Set SANITY_STUDIO_PROJECT_ID (and optionally SANITY_STUDIO_FILESPIN_HOST,
 * e.g. https://appdev.filespin.io) in test-studio/.env.
 */
import {defineConfig, defineField, defineType} from 'sanity'
import {structureTool} from 'sanity/structure'
import {filespin} from '../src'

const post = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({name: 'title', type: 'string'}),
    defineField({
      name: 'hero',
      title: 'Hero image (FileSpin, images only)',
      type: 'filespin.asset',
      options: {accept: 'image'},
    }),
    defineField({
      name: 'video',
      title: 'Video (FileSpin, videos only)',
      type: 'filespin.asset',
      options: {accept: 'video'},
    }),
    defineField({name: 'media', title: 'Any FileSpin asset', type: 'filespin.asset'}),
    defineField({
      name: 'gallery',
      title: 'Gallery (FileSpin)',
      type: 'array',
      of: [{type: 'filespin.asset'}],
    }),
    defineField({
      name: 'sanityImage',
      title: 'Sanity image (FileSpin copies into Sanity)',
      type: 'image',
      options: {hotspot: true},
    }),
    defineField({name: 'sanityFile', title: 'Sanity file', type: 'file'}),
  ],
})

export default defineConfig({
  name: 'default',
  title: 'FileSpin plugin test',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'missing',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  plugins: [structureTool(), filespin({host: process.env.SANITY_STUDIO_FILESPIN_HOST || undefined})],
  schema: {types: [post]},
})
