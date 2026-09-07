import * as THREE from "three";

// Shared geometry keeps bursts of short commands inexpensive.
export function createRocketLauncher(scene) {
  const rockets = [];
  const body = new THREE.CylinderGeometry(0.095, 0.095, 0.42, 12);
  const cone = new THREE.ConeGeometry(0.095, 0.2, 12);
  const fin = new THREE.ConeGeometry(0.17, 0.24, 4);
  const flame = new THREE.ConeGeometry(0.075, 0.38, 10);
  const spark = new THREE.SphereGeometry(0.045, 6, 4);
  const white = new THREE.MeshBasicMaterial({ color: "#fff7e9" });
  const red = new THREE.MeshBasicMaterial({ color: "#e66548" });
  const gold = new THREE.MeshBasicMaterial({ color: "#ffbf47" });
  const blue = new THREE.MeshBasicMaterial({ color: "#669eb9" });

  function remove(index) {
    const rocket = rockets[index];
    scene.remove(rocket.root);
    rocket.trailMaterial.dispose();
    rockets.splice(index, 1);
  }

  return {
    clear() {
      while (rockets.length) remove(rockets.length - 1);
    },
    launch(plane) {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (rockets.length >= 24) remove(0);
      const root = new THREE.Group();
      root.quaternion.copy(plane.quaternion);
      root.position.copy(plane.localToWorld(new THREE.Vector3(
        (Math.random() - 0.5) * plane.geometry.parameters.width * 0.6,
        plane.geometry.parameters.height / 2 - 0.15, 0.25
      )));
      const ship = new THREE.Group();
      const hull = new THREE.Mesh(body, white);
      const nose = new THREE.Mesh(cone, red);
      nose.position.y = 0.31;
      const fins = new THREE.Mesh(fin, red);
      fins.position.y = -0.15;
      const window = new THREE.Mesh(spark, blue);
      window.position.set(0, 0.07, 0.09);
      const exhaust = new THREE.Mesh(flame, gold);
      exhaust.rotation.z = Math.PI;
      exhaust.position.y = -0.39;
      ship.add(hull, nose, fins, window, exhaust);
      root.add(ship);
      const trailMaterial = new THREE.MeshBasicMaterial({
        color: "#e9a958", transparent: true, opacity: 0.7, depthWrite: false
      });
      const trail = Array.from({ length: 18 }, () => {
        const particle = new THREE.Mesh(spark, trailMaterial);
        root.add(particle);
        return particle;
      });
      scene.add(root);
      rockets.push({ root, ship, exhaust, trail, trailMaterial, age: 0 });
    },
    update(dt) {
      for (let i = rockets.length - 1; i >= 0; i--) {
        const rocket = rockets[i];
        const t = rocket.age += dt;
        if (t > 2.2) { remove(i); continue; }
        const height = age => 1.2 * age + 5 * age * age;
        rocket.ship.position.set(0.25 * t * t, height(t), 0);
        rocket.ship.rotation.z = -0.08 * t;
        rocket.exhaust.scale.y = 0.8 + Math.random() * 0.5;
        rocket.ship.scale.setScalar(Math.min(1, (2.2 - t) * 3));
        rocket.trailMaterial.opacity = 0.65 * Math.min(1, (2.2 - t) * 2);
        rocket.trail.forEach((particle, j) => {
          const age = Math.max(0, t - j * 0.025);
          particle.position.set(0.25 * age * age + Math.sin(j * 7) * j * 0.007,
            height(age) - 0.45 - j * 0.04, 0);
          particle.scale.setScalar((1 - j / rocket.trail.length) * 1.8);
        });
      }
    }
  };
}
