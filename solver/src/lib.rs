//! Linear-time scoring of normalized, directed straight-through movements.
//! Geometry, street names and access interpretation belong to the audited importer.
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const NONE: u32 = u32::MAX;
pub const UP_OPEN: u32 = 1;
pub const DOWN_OPEN: u32 = 2;
pub const CYCLE: u32 = 4;

#[derive(Debug, Error)]
pub enum ScoreError {
    #[error("graph columns have different lengths or exceed u32 capacity")]
    InvalidColumns,
    #[error("invalid successor {next} for state {state}")]
    InvalidSuccessor { state: usize, next: u32 },
    #[error("distance overflow")]
    Overflow,
    #[error("invalid physical segment: {0}")]
    InvalidSegment(String),
}

/// Structure-of-arrays graph. Open flags must cover both sides of ambiguous junctions.
#[derive(Debug, Default)]
pub struct Graph {
    pub length: Vec<u64>,
    pub next: Vec<u32>,
    pub flags: Vec<u32>,
}

#[derive(Debug)]
pub struct Scores {
    pub up: Vec<u64>,
    pub down: Vec<u64>,
    pub flags: Vec<u32>,
    pub predecessor: Vec<u32>,
}
impl Scores {
    pub fn run(&self, graph: &Graph, e: usize) -> Result<u64, ScoreError> {
        if self.flags[e] & CYCLE != 0 {
            return Ok(0);
        }
        self.up[e]
            .checked_sub(graph.length[e])
            .and_then(|v| v.checked_add(self.down[e]))
            .ok_or(ScoreError::Overflow)
    }
    pub fn exact(&self, e: usize) -> bool {
        self.flags[e] == 0
    }
}

/// Quarantines cycles and every approach leading to one before distance accumulation.
pub fn solve(graph: &Graph) -> Result<Scores, ScoreError> {
    let n = graph.length.len();
    if n >= NONE as usize || n != graph.next.len() || n != graph.flags.len() {
        return Err(ScoreError::InvalidColumns);
    }
    let mut indegree = vec![0u32; n];
    for (e, &next) in graph.next.iter().enumerate() {
        if next == NONE {
            continue;
        }
        if next as usize >= n {
            return Err(ScoreError::InvalidSuccessor { state: e, next });
        }
        indegree[next as usize] += 1;
    }
    let mut order = Vec::with_capacity(n);
    for (e, &degree) in indegree.iter().enumerate() {
        if degree == 0 {
            order.push(e as u32);
        }
    }
    let mut cursor = 0;
    while cursor < order.len() {
        let e = order[cursor] as usize;
        cursor += 1;
        let next = graph.next[e];
        if next != NONE {
            indegree[next as usize] -= 1;
            if indegree[next as usize] == 0 {
                order.push(next);
            }
        }
    }
    let mut flags = graph.flags.clone();
    for (e, &degree) in indegree.iter().enumerate() {
        if degree != 0 {
            flags[e] |= CYCLE;
        }
    }
    for &e in order.iter().rev() {
        let next = graph.next[e as usize];
        if next != NONE && flags[next as usize] & CYCLE != 0 {
            flags[e as usize] |= CYCLE;
        }
    }
    let mut up = graph.length.clone();
    let mut down = graph.length.clone();
    let mut predecessor = vec![NONE; n];
    for &id in &order {
        let e = id as usize;
        if flags[e] & CYCLE != 0 {
            continue;
        }
        let next = graph.next[e];
        if next == NONE {
            continue;
        }
        let next = next as usize;
        let candidate = up[e]
            .checked_add(graph.length[next])
            .ok_or(ScoreError::Overflow)?;
        if candidate > up[next] || (candidate == up[next] && id < predecessor[next]) {
            up[next] = candidate;
            predecessor[next] = id;
        }
        flags[next] |= flags[e] & UP_OPEN;
    }
    for &id in order.iter().rev() {
        let e = id as usize;
        if flags[e] & CYCLE != 0 {
            up[e] = 0;
            down[e] = 0;
            continue;
        }
        let next = graph.next[e];
        if next != NONE {
            down[e] = graph.length[e]
                .checked_add(down[next as usize])
                .ok_or(ScoreError::Overflow)?;
            flags[e] |= flags[next as usize] & DOWN_OPEN;
        }
    }
    Ok(Scores {
        up,
        down,
        flags,
        predecessor,
    })
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Segment {
    pub sid: u32,
    pub gw_mm: u64,
    pub states: Vec<u32>,
    pub directions_resolved: bool,
    pub inaccessible: bool,
}
#[derive(Debug, Serialize, Deserialize)]
pub struct SegmentScore {
    pub sid: u32,
    pub gw_mm: u64,
    pub lb_mm: u32,
    pub exact: u8,
    pub controlling_state: Option<u32>,
}

/// Combines directions by maximum, never by adding opposing traversal lengths.
pub fn score_segment(
    segment: &Segment,
    graph: &Graph,
    scores: &Scores,
) -> Result<SegmentScore, ScoreError> {
    if segment.inaccessible && (!segment.states.is_empty() || !segment.directions_resolved) {
        return Err(ScoreError::InvalidSegment(
            "inaccessible segment has states or unresolved access".into(),
        ));
    }
    let mut exact =
        segment.directions_resolved && (segment.inaccessible || !segment.states.is_empty());
    let mut lb = 0;
    let mut controlling = None;
    for &id in &segment.states {
        let e = id as usize;
        if e >= graph.length.len() {
            return Err(ScoreError::InvalidSegment("state out of range".into()));
        }
        exact &= scores.exact(e);
        let distance = scores.run(graph, e)?;
        if controlling.is_none() || distance > lb || (distance == lb && Some(id) < controlling) {
            lb = distance;
            controlling = Some(id);
        }
    }
    Ok(SegmentScore {
        sid: segment.sid,
        gw_mm: segment.gw_mm,
        lb_mm: u32::try_from(lb).map_err(|_| ScoreError::Overflow)?,
        exact: u8::from(exact),
        controlling_state: controlling,
    })
}

/// Determines the geometric candidate before applying legal restrictions.
#[derive(Debug, PartialEq)]
pub enum Continuation {
    Candidate(usize),
    End,
    Unresolved,
}
pub fn continuation(angles: &[f64], complete_ordinary: bool) -> Continuation {
    if !complete_ordinary
        || angles
            .iter()
            .any(|a| !a.is_finite() || !(0.0..=180.0).contains(a))
    {
        return Continuation::Unresolved;
    }
    let mut candidate = None;
    for (i, &angle) in angles.iter().enumerate() {
        if angle <= 30.0 {
            if candidate.is_some() {
                return Continuation::Unresolved;
            }
            candidate = Some(i);
        } else if angle < 60.0 {
            return Continuation::Unresolved;
        }
    }
    candidate.map_or(Continuation::End, Continuation::Candidate)
}

#[derive(Debug, PartialEq)]
pub enum Class {
    Pass,
    Fail,
    Unknown,
}
pub fn classify(lb: u64, exact: bool, threshold: u64) -> Class {
    if lb >= threshold {
        Class::Fail
    } else if exact {
        Class::Pass
    } else {
        Class::Unknown
    }
}
