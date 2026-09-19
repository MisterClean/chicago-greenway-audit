use greenway_solver::*;
fn graph(length: &[u64], next: &[u32]) -> Graph {
    Graph {
        length: length.to_vec(),
        next: next.to_vec(),
        flags: vec![0; length.len()],
    }
}
fn runs(g: &Graph) -> Vec<u64> {
    let s = solve(g).unwrap();
    (0..g.length.len()).map(|e| s.run(g, e).unwrap()).collect()
}
#[test]
fn full_chain_and_edge_splitting() {
    assert_eq!(runs(&graph(&[100, 200, 300], &[1, 2, NONE])), vec![600; 3]);
    assert_eq!(
        runs(&graph(&[50, 50, 200, 300], &[1, 2, 3, NONE])),
        vec![600; 4]
    );
}
#[test]
fn merge_keeps_short_branch_score_and_all_uncertainty() {
    let mut g = graph(&[100, 200, 300, 10], &[2, 2, NONE, 2]);
    g.flags[3] = UP_OPEN;
    let s = solve(&g).unwrap();
    assert_eq!(runs(&g), vec![400, 500, 500, 310]);
    assert!(!s.exact(2));
    assert!(s.exact(0));
    assert_eq!(s.predecessor[2], 1);
}
#[test]
fn cycles_and_approaches_are_quarantined_before_overflow() {
    let g = graph(&[u64::MAX, u64::MAX, 10, 30], &[1, 0, 0, NONE]);
    let s = solve(&g).unwrap();
    assert_eq!(runs(&g), vec![0, 0, 0, 30]);
    assert!(!s.exact(2));
    assert!(s.exact(3));
}
#[test]
fn boundaries_equality_direction_and_inaccessible() {
    let mut g = graph(&[2_000, 400], &[NONE, NONE]);
    g.flags[0] = DOWN_OPEN;
    let s = solve(&g).unwrap();
    let segment = Segment {
        sid: 1,
        gw_mm: 10,
        states: vec![0, 1],
        directions_resolved: true,
        inaccessible: false,
    };
    let score = score_segment(&segment, &g, &s).unwrap();
    assert_eq!(score.lb_mm, 2000);
    assert_eq!(score.exact, 0);
    assert_eq!(classify(2000, false, 2000), Class::Fail);
    assert_eq!(classify(2000, false, 3000), Class::Unknown);
    assert_eq!(classify(400, true, 500), Class::Pass);
    let closed = Segment {
        sid: 2,
        gw_mm: 10,
        states: vec![],
        directions_resolved: true,
        inaccessible: true,
    };
    assert_eq!(score_segment(&closed, &g, &s).unwrap().exact, 1);
}
#[test]
fn angle_policy_does_not_choose_turning_fallback() {
    assert_eq!(continuation(&[29., 90.], true), Continuation::Candidate(0));
    assert_eq!(continuation(&[31., 90.], true), Continuation::Unresolved);
    assert_eq!(continuation(&[10., 20.], true), Continuation::Unresolved);
    assert_eq!(continuation(&[90.], true), Continuation::End);
    assert_eq!(continuation(&[], false), Continuation::Unresolved);
    assert_eq!(continuation(&[30., 60.], true), Continuation::Candidate(0));
}
#[test]
fn rejects_bad_indices_and_overflow() {
    assert!(solve(&graph(&[1], &[3])).is_err());
    assert!(solve(&graph(&[u64::MAX, 1], &[1, NONE])).is_err());
}
#[test]
fn deterministic_tie_uses_lowest_state_id() {
    let g = graph(&[10, 10, 20], &[2, 2, NONE]);
    assert_eq!(solve(&g).unwrap().predecessor[2], 0);
}
// Independent oracle enumerates every prefix-start path; it shares no DP arrays.
#[test]
fn generated_graphs_match_exhaustive_path_oracle() {
    let mut rng = 73u64;
    let mut random = || {
        rng = rng.wrapping_mul(6364136223846793005).wrapping_add(1);
        rng >> 32
    };
    for _ in 0..1000 {
        let n = 1 + (random() % 20) as usize;
        let mut g = Graph::default();
        for i in 0..n {
            g.length.push(1 + random() % 1000);
            g.next.push(if i + 1 == n || random() % 4 == 0 {
                NONE
            } else {
                (i + 1 + (random() % (n - i - 1) as u64) as usize) as u32
            });
            g.flags.push((random() % 4) as u32);
        }
        let solved = solve(&g).unwrap();
        for target in 0..n {
            let mut longest = 0;
            let mut upstream_open = false;
            let mut downstream_open = false;
            for start in 0..n {
                let mut path = vec![];
                let mut e = start;
                loop {
                    path.push(e);
                    if g.next[e] == NONE {
                        break;
                    }
                    e = g.next[e] as usize;
                }
                if let Some(index) = path.iter().position(|&e| e == target) {
                    longest = longest.max(path.iter().map(|&e| g.length[e]).sum::<u64>());
                    upstream_open |= path[..=index].iter().any(|&e| g.flags[e] & UP_OPEN != 0);
                    downstream_open |= path[index..].iter().any(|&e| g.flags[e] & DOWN_OPEN != 0);
                }
            }
            assert_eq!(solved.run(&g, target).unwrap(), longest);
            assert_eq!(solved.exact(target), !upstream_open && !downstream_open);
        }
    }
}
