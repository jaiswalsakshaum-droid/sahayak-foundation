-- Migration: Add preferred_language to public.profiles
-- Task 1: Multi-language support

alter table public.profiles
  add column if not exists preferred_language text not null default 'en'
  check (preferred_language in ('en', 'hi', 'bn', 'mr', 'te', 'ta'));
