use anyhow::{Context, Result, bail};
use greenway_solver::{
    DOWN_OPEN, Graph, NONE, Segment, SegmentScore, UP_OPEN, score_segment, solve,
};
use serde::Deserialize;
use std::{
    collections::{BTreeMap, HashSet},
    fs::{self, File},
    io::{BufRead, BufReader, BufWriter, Write},
    path::Path,
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct State {
    id: u32,
    length_mm: u64,
    next: Option<u32>,
    up_open: bool,
    down_open: bool,
}
fn rows<T: serde::de::DeserializeOwned>(
    path: &Path,
    mut f: impl FnMut(T) -> Result<()>,
) -> Result<()> {
    for (i, line) in BufReader::new(File::open(path)?).lines().enumerate() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        f(serde_json::from_str(&line)
            .with_context(|| format!("{} line {}", path.display(), i + 1))?)?;
    }
    Ok(())
}
fn add(distribution: &mut BTreeMap<u32, u64>, score: u32, length: u64) -> Result<()> {
    let value = distribution.entry(score).or_default();
    *value = value.checked_add(length).context("total overflow")?;
    Ok(())
}
fn summary(
    path: &Path,
    exact: &BTreeMap<u32, u64>,
    all: &BTreeMap<u32, u64>,
    total: u64,
) -> Result<()> {
    if total > 9_007_199_254_740_991 {
        bail!("totals exceed JavaScript exact integer range");
    }
    // Header (32 bytes), then thresholds u32, padding to 8, cumulative lengths f64.
    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"GWAYIDX1");
    bytes.extend_from_slice(&1u32.to_le_bytes());
    bytes.extend_from_slice(&u32::try_from(exact.len())?.to_le_bytes());
    bytes.extend_from_slice(&u32::try_from(all.len())?.to_le_bytes());
    bytes.extend_from_slice(&0u32.to_le_bytes());
    bytes.extend_from_slice(&(total as f64).to_le_bytes());
    for distribution in [exact, all] {
        for score in distribution.keys() {
            bytes.extend_from_slice(&score.to_le_bytes());
        }
        while bytes.len() % 8 != 0 {
            bytes.push(0);
        }
        let mut cumulative = 0u64;
        for length in distribution.values() {
            cumulative = cumulative.checked_add(*length).context("total overflow")?;
            bytes.extend_from_slice(&(cumulative as f64).to_le_bytes());
        }
    }
    fs::write(path, bytes)?;
    Ok(())
}
fn main() -> Result<()> {
    let args: Vec<_> = std::env::args_os().collect();
    if args.len() != 4 {
        bail!("usage: greenway-solver STATES.ndjson SEGMENTS.ndjson OUTPUT_DIRECTORY");
    }
    let mut graph = Graph::default();
    rows::<State>(Path::new(&args[1]), |s| {
        if s.id as usize != graph.length.len() || s.id == NONE {
            bail!("state IDs must be dense and ordered from zero");
        }
        graph.length.push(s.length_mm);
        graph.next.push(s.next.unwrap_or(NONE));
        graph
            .flags
            .push(if s.up_open { UP_OPEN } else { 0 } | if s.down_open { DOWN_OPEN } else { 0 });
        Ok(())
    })?;
    let scores = solve(&graph)?;
    let out = Path::new(&args[3]);
    fs::create_dir_all(out)?;
    let mut output = BufWriter::new(File::create(out.join("scores.ndjson"))?);
    let (mut exact, mut all) = (BTreeMap::new(), BTreeMap::new());
    let mut seen = HashSet::new();
    let mut total = 0u64;
    rows::<Segment>(Path::new(&args[2]), |segment| {
        if !seen.insert(segment.sid) {
            bail!("duplicate segment ID {}", segment.sid);
        }
        let score: SegmentScore = score_segment(&segment, &graph, &scores)?;
        add(&mut all, score.lb_mm, score.gw_mm)?;
        if score.exact == 1 {
            add(&mut exact, score.lb_mm, score.gw_mm)?;
        }
        total = total.checked_add(score.gw_mm).context("total overflow")?;
        serde_json::to_writer(&mut output, &score)?;
        writeln!(output)?;
        Ok(())
    })?;
    output.flush()?;
    summary(&out.join("summary.bin"), &exact, &all, total)?;
    let mut witness = BufWriter::new(File::create(out.join("witnesses.ndjson"))?);
    for e in 0..graph.length.len() {
        serde_json::to_writer(
            &mut witness,
            &serde_json::json!({"state":e,"predecessor":(scores.predecessor[e] != NONE).then_some(scores.predecessor[e]),"next":(graph.next[e] != NONE).then_some(graph.next[e]),"lb_mm":scores.run(&graph,e)?,"exact":scores.exact(e),"flags":scores.flags[e]}),
        )?;
        writeln!(witness)?;
    }
    eprintln!(
        "scored {} states, {} segments, {} designated mm",
        graph.length.len(),
        seen.len(),
        total
    );
    Ok(())
}
