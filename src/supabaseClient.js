import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://yntpkyoecocjskabhuxv.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InludHBreW9lY29janNrYWJodXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NzE4MzAsImV4cCI6MjEwODM0NzgzMH0.wefP4OjWjDhVQ-30YuzK2ERJO-vyMCgw5K5x411GLuA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
