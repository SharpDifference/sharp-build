// A mod carrying its own data in the backup file declares it on core's `backup` module.
export {}

declare module '../../../src/shared/backup' {
  interface KitDtsFixture {
    field?: string
  }
}
