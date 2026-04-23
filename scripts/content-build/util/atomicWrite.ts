import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, dirname, join } from 'node:path';

export type GeneratedFile = Readonly<{
  path: string;
  contents: string;
}>;

type TargetSnapshot = Readonly<
  | {
      path: string;
      existed: true;
      contents: string;
    }
  | {
      path: string;
      existed: false;
    }
>;

export async function atomicWrite(files: ReadonlyArray<GeneratedFile>): Promise<void> {
  if (files.length === 0) {
    return;
  }

  const stagedFiles: string[] = [];
  const appliedTargets = new Set<string>();
  let targetSnapshots: ReadonlyArray<TargetSnapshot> = [];

  try {
    for (const file of files) {
      const directory = dirname(file.path);
      await mkdir(directory, { recursive: true });
      const stagedPath = join(
        directory,
        `.${basename(file.path)}.${process.pid}.${randomUUID()}.tmp`
      );
      await writeFile(stagedPath, file.contents, 'utf8');
      stagedFiles.push(stagedPath);
    }

    targetSnapshots = await snapshotTargets(files);

    for (let index = 0; index < files.length; index += 1) {
      const stagedPath = stagedFiles[index];
      const target = files[index]?.path;
      if (stagedPath === undefined || target === undefined) {
        throw new Error('atomic write staging invariant failed');
      }
      await rename(stagedPath, target);
      appliedTargets.add(target);
    }
  } catch (error) {
    await Promise.all(stagedFiles.map((path) => rm(path, { force: true })));
    await rollbackAppliedTargets(targetSnapshots, appliedTargets);
    throw error;
  }
}

async function snapshotTargets(files: ReadonlyArray<GeneratedFile>): Promise<ReadonlyArray<TargetSnapshot>> {
  const snapshots: TargetSnapshot[] = [];
  for (const file of files) {
    try {
      snapshots.push({
        path: file.path,
        existed: true,
        contents: await readFile(file.path, 'utf8')
      });
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        snapshots.push({ path: file.path, existed: false });
        continue;
      }
      throw error;
    }
  }
  return snapshots;
}

async function rollbackAppliedTargets(
  snapshots: ReadonlyArray<TargetSnapshot>,
  appliedTargets: ReadonlySet<string>
): Promise<void> {
  await Promise.all(
    snapshots
      .filter((snapshot) => appliedTargets.has(snapshot.path))
      .map((snapshot) =>
        snapshot.existed
          ? writeFile(snapshot.path, snapshot.contents, 'utf8')
          : rm(snapshot.path, { force: true })
      )
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
