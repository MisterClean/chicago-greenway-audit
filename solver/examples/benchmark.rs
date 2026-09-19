use greenway_solver::{Graph, NONE, solve};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let n = 1_000_000;
    let mut next: Vec<u32> = (1..=n as u32).collect();
    next[n - 1] = NONE;
    let graph = Graph {
        length: vec![1000; n],
        next,
        flags: vec![0; n],
    };
    let start = std::time::Instant::now();
    let scores = solve(&graph)?;
    assert_eq!(scores.run(&graph, n - 1)?, n as u64 * 1000);
    println!(
        "{} states, {:.3} ms, all edges receive full chain distance",
        n,
        start.elapsed().as_secs_f64() * 1000.0
    );
    Ok(())
}
